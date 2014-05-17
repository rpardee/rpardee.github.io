=begin
  troll_path.rb

  Roy Pardee
  pardee.r@ghc.org
  Copyright 2010 Group Health Cooperative.  All rights reserved.

  Does path-report-based "rapid ascertainment" for the onconurse (aka nurse navigator) project.

  We want anybody who appears to be diagnosed w/breast, lung or colorectal cancer, who has one of
  our consenting docs as a PCP.

=end

require '//server/OncologyNurse/Programming/programs/globals'
require '//server/OncologyNurse/Programming/programs/pci4r/lib/filtering'
require '//home/pardre1/reference/FeedHelper'

STORE = "//server/OncologyNurse/Programming/programs/persisted_classifiers/"

String.n_gram_length = 3
String.remove_stop_words(%w(cant couldnt didn didnt doesnt dont isnt no not))

CLASSIFIER_EXTENSION      = ".db"
UNWANTED_REVIEW_THRESHOLD = 0.1
LOOKBACK_PERIOD           = 14
PROGRAM_VERSION           = '1.0'

PathHandler = Struct.new(:classifier, :ar_config, :detector_regex, :report_count, :wanted_count, :review_requested_count)

def get_handlers(types = %w(breast lung colorectal))
  handlers = Hash.new
  types.each do |c|
    h = PathHandler.new

    h.report_count = 0
    h.wanted_count = 0
    h.review_requested_count = 0

    h.classifier = Filtering::Fisher.new {|doc| doc.tokenise}
    dbfile = STORE + c + CLASSIFIER_EXTENSION
    h.ar_config = {:adapter => "sqlite3", :database => dbfile}
    puts("=-=" * 25)
    puts("Loading up classifier for #{c}")
    puts("=-=" * 25)
    STDOUT.flush
    h.classifier.load_from_ar(h.ar_config, "PRAGMA default_synchronous=OFF")

    h.detector_regex = case c
    when "breast"
      /(axilla|breast|brst|brest|braest|brast|bresat|lumpec|mastec|br\s|\smamm)/i
    when "lung"
      /(lung|bronc|pleur|pluer|ebus|hilar|(upper|middle|lower)\slobe|pulmonary)/i  # That misspelling on 'pleur' is mine--experimental.
    when "colorectal"
      # This once picked up a report w/the word 'colonization'--do we need to add a space after 'colon'?
      # Happened again--yes we do.
      /(colon[^i]|ulcerative\scolitis|rectum|rectal|\srecto|sigmoid|cecal|tubulovillous|\sanal\W|colectomy|abdominoperineal|colonic|large\sbowel|gastrointestinal|transverse)/i
    else
      raise(NameError, "Unexpected type of path handler called for!  The type was '#{c}'.")
    end
    handlers[c] = h
  end
  handlers
end

def get_new_likelies(conn, handlers)
  num_reports = 0
  sql_get = %{select message_id, chsid, colldt, surg_hisdx_diagnosis, note, hissupp_supplemental, surg_hismicro_microscopicexamination
              from pathology.dbo.daily_hl7
              where rptdate >= ? AND
              message_id not in (select message_id from path_reports)
            }
  ins_fields = %w{mrn message_id report_type colldt diagdesc p_want p_dont_want review_requested}
  sql_ins = %{insert into path_reports ( #{ins_fields.join(', ')} ) values (#{('? ' * ins_fields.length).split.join(', ')})}
  sql_log_ins = %{insert into inspected_path_reports(message_id, date_evaluated, report_type, p_want, p_dont_want, report_text) values(?, ?, ?, ?, ?, ?)}
  crlf = "\r\n"

  # X path reports evaluated
  # Y were for an organ we want
  # Z were for people with cancers
  # A had PCPs that are OncoNurse docs.
  # B were for people not already enrolled in OncoNurse

  ins_cmd = conn.prepare(sql_ins)
  ins_log_cmd = conn.prepare(sql_log_ins)

  conn.execute(sql_get, LOOKBACK_PERIOD.days.ago).fetch do |r|
    # Ed Wagner wants to see any colorectal report.
    ed_override = nil
    num_reports += 1
    # unmunged_diagdesc = "r["note"] + r["surg_hisdx_diagnosis"] + r["hissupp_supplemental"]"
    # unmunged_diagdesc = "#{r['note']} #{r['surg_hisdx_diagnosis']} #{r['hissupp_supplemental']}"
    unmunged_diagdesc = "#{r['note']} #{r['surg_hisdx_diagnosis']} #{r['hissupp_supplemental']} #{r['surg_hismicro_microscopicexamination']} "
    diagdesc = unmunged_diagdesc.gsub(/~/, crlf)
    diagdesc.gsub!(/(\r\n){2,}/, crlf)

    log_entry = Hash.new
    log_entry[:message_id] = r["message_id"]
    log_entry[:report_text] = diagdesc[0..7899]
    log_entry[:report_type] = "Uninteresting"
    handlers.each do |handler_type, handler|
      if handler.detector_regex.match(diagdesc) then
        log_entry[:report_type] = handler_type
        puts("Got a #{handler_type} report message_id: #{r['message_id']}")
        handler.report_count += 1
        classifications = handler.classifier.classifications(diagdesc)
        log_entry[:p_want] = classifications[:wanted]
        log_entry[:p_dont_want] = classifications[:unwanted]

        # Adding lung to the list of types on whom we will take all comers.
        if %w(colorectal lung).include?(handler_type) then
          # puts("Checking for the 'Ed Wagner Override'")
          # ed_override = diagdesc.match(/carcinoma/i)
          # puts("OVERRIDING THE CLASSIFIER") if ed_override
          ed_override = true
        end if
        puts(classifications.inspect)
        if (classifications[:wanted] > classifications[:unwanted]) or ed_override or classifications[:wanted] > 0.99 then
          handler.wanted_count += 1
          # We want this guy.  Do we need to request review?
          request_review = classifications[:unwanted] > UNWANTED_REVIEW_THRESHOLD ? 'Y' : 'N'
          handler.review_requested_count += 1 if request_review == 'Y'
          # puts("About to insert path report w/msg id #{r['message_id']}")
            ins_cmd.execute(r["chsid"], r["message_id"], handler_type, r["colldt"], diagdesc, classifications[:wanted], classifications[:unwanted], request_review)
        end
      end # regex did not match--do nothing
    end # loop through the handlers
    # at this point, we either matched a handler regex (in which case we have a non-nil classifications object) or we didn't.  Either way we want to log that we touched this report record.
    # insert into inspected_path_reports(message_id, date_evaluated, report_type, p_want, p_dont_want, report_text) values
    begin
      ins_log_cmd.execute(log_entry[:message_id], Date.today, log_entry[:report_type], log_entry[:p_want], log_entry[:p_dont_want], log_entry[:report_text] )
    rescue DBI::DatabaseError => er
      if er.message =~ /PK_inspected_path_reports/ then
        # ignore
      else  # Other kind of db exception.
        raise(er)
      end
    end
    
  end # loop through the sql_get fetch.
  conn.commit
  num_reports
end

def zero_pad(num, len = 6)
  str = num.to_s
  "0" * (len - str.length) + str
end

# Determines the PCP of each new person in path_reports.
def get_pcps(mssql, syb)

  sql = %{select id, c.consumno from path_reports as p INNER JOIN CHSDW_Enrollment.dbo.chsid as c on p.mrn = c.chsid where pcp IS NULL}

  sql_upd = %{update path_reports set pcp = ?, consumno = ? where id = ?}

  mssql.execute(sql).fetch do |r|
    pcp = syb.select_one("select csr_pcp_nbr from csr_dem where csr_nbr = '#{r['consumno']}'")[0]
    # puts("PCP is #{pcp}")
    mssql.execute(sql_upd, zero_pad(pcp), r['consumno'], r["id"])
  end
  mssql.commit
  puts("Finished looking for pcps")
end

@next_studyid = -1

def add_recruit(sth_add_recruit, recruit_info, path)
  # field list:
  # mrn, sex, randy, bdate, lastname, firstname, middlename, namesuffix, recruitprogversion, cancertype, studyid, consumno, PrimryDr, condition
  mrn = path['mrn']
  sex = recruit_info['Sex']
  randy = rand
  bdate = recruit_info['DOB'] || '2011-12-25'

  lastname    = CaseManager.prettify(recruit_info['LastName'])
  firstname   = CaseManager.prettify(recruit_info['FirstName'])
  middlename  = CaseManager.prettify(recruit_info['MiddleName'])
  namesuffix  = recruit_info['NameSuffix']
  recruitprogversion = PROGRAM_VERSION
  cancertype  = path['report_type'].capitalize
  studyid     = zero_pad(@next_studyid)
  consumno    = path['consumno']
  pcp         = path['pcp']
  condition   = path['condition']
  begin
    puts("Adding a recruit w/studyid #{studyid} in condition '#{condition}'.")
    sth_add_recruit.execute(mrn, sex, randy, bdate, lastname, firstname, middlename, namesuffix, recruitprogversion, cancertype, studyid, consumno, pcp, condition)
  rescue DBI::DatabaseError => de
    if de.message =~ /Cannot insert the value NULL into column 'BDate'/ then
      # Person w/the null bdate is 00715061.
      puts("Problem--got a null bdate for consumno #{consumno}--skipping.")
    else  # Other kind of db exception.
      raise(de)
    end
  rescue Exception => e
    raise(e)
  else
    @next_studyid += 1
  end
  # puts("Pretend I added #{firstname + ' ' + lastname}")
end

# insert address(if new)
def add_address(mssql, sth_add_address, recruit_info, rid)
  # recruitid, Line1, Line2, City, State, Zip
  line1 = CaseManager.prettify(recruit_info['MailingAddressLine1'])
  line2 = CaseManager.prettify(recruit_info['MailingAddressLine2'])
  city  = CaseManager.prettify(recruit_info['MailingCity'])
  state = (recruit_info['MailingState'] || '').upcase
  zip   = CaseManager.prettify(recruit_info['MailingZip'])

  if (line1 || '').length < (line2 || '').length then
    # Swap line1 & line2
    line1, line2 = line2, line1
  end

  if mssql.select_one("select count(*) as cnt from addresses where recruitid = #{rid} and line1 = '#{line1}' and city = '#{city}'")['cnt'] == 0 then
    sth_add_address.execute(rid, line1, line2, city, state, zip)
    puts("Added an address for recruitid #{rid}.")
  end
end

# insert phone(if new)
def add_phone(mssql, sth_add_phone, recruit_info, rid)
  ac = recruit_info['AreaCode']
  phone = recruit_info['PhoneNumber']
  phone = (phone || '').gsub(/\D/, '')[0..6]
  ext = recruit_info['Extension']
  if ac and ac.length > 0 and phone.length > 0 then
    if mssql.select_one("select count(*) as cnt from PhoneNumbers where recruitid = #{rid} and phonenumber = '#{phone}'")['cnt'] == 0 then
      # recruitid, type, areacode, phonenumber, extension, source
      sth_add_phone.execute(rid, 'Unknown', ac, phone, ext, 'GHDW')
      puts("Added a phone number for recruitid #{rid}")
    end
  else
    puts("Unable to add phone number (#{ac} #{phone})")
  end
  aac = recruit_info['AltAreaCode']
  aphone = recruit_info['AltPhoneNumber']
  aphone = (aphone || '').gsub(/\D/, '')[0..6]
  aext = recruit_info['AltExtension']
  if aac and aac.length > 0 and aphone.length > 0 then
    puts("Alt phone info is #{aac} #{aphone} #{aext}")
    if mssql.select_one("select count(*) as cnt from PhoneNumbers where recruitid = #{rid} and phonenumber = '#{aphone}'")['cnt'] == 0 then
      puts("In if statement looking for an existing rec w/the alt phone number.")
      # recruitid, type, areacode, phonenumber, extension, source
      sth_add_phone.execute(rid, 'Unknown', aac, aphone, aext, 'GHDW')
      puts("Added an alternate phone number for recruitid #{rid}")
    end
  else
    puts("Unable to add alt phone number (#{aac}) #{aphone}")
  end
end


def vet_newbies(mssql, syb)
  num_considered  = 0
  num_added       = 0
  num_already_in  = 0
  num_rehabbed    = 0
  num_nonos       = 0

  ditched_status  = 0
  accepted_status = 0
  rehab_status    = 0

  sql_syb = %{SELECT CSR_LST_NME as LastName
           , CSR_FST_NME         as FirstName
           , CSR_MID_NME         as MiddleName
           , CSR_SFX_NME         as NameSuffix
           , CSR_ALT_ADR_LN1     as MailingAddressLine1
           , CSR_ALT_ADR_LN2     as MailingAddressLine2
           , CSR_ALT_ADR_CTY_NME as MailingCity
           , CSR_ALT_ADR_ST_CDE  as MailingState
           , CSR_ALT_ADR_ZIP     as MailingZip
           , CSR_PHN_AC          as AreaCode
           , CSR_PHN_NBR         as PhoneNumber
           , CSR_PHN_EXT         as Extension
           , CSR_ALT_PHN_AC      as AltAreaCode
           , CSR_ALT_PHN_NBR     as AltPhoneNumber
           , CSR_ALT_PHN_EXT     as AltExtension
           , csr_sex_cde         as Sex
           , csr_brt_dte         as DOB
           from csr_id i INNER JOIN
                  csr_dem d
          on   i.csr_nbr = d.csr_nbr
          where i.csr_nbr = ?}

  get = syb.prepare(sql_syb)

  sql_add_recruit = %{insert into recruits(mrn, sex, randy, bdate, lastname, firstname, middlename, namesuffix, recruitprogversion, cancertype, studyid, consumno, PrimryDr, condition)
                      values              (?,   ?,    ?,    ?,      ?,        ?,        ?,          ?,          ?,                  ?,          ?,      ?,        ?,          ?)}
  sql_get_recruitid = %{select recruitid from recruits where consumno = ?}
  sql_add_address   = %{insert into addresses (recruitid, PreferenceRank, Line1, Line2, City, State, Zip)
                        values                (?,         ?,              ?,      ?,    ?,    ?,      ?)}
  sql_add_address   = %{exec InsertAddress @RecruitID = ?, @Line1 = ?, @Line2 = ?, @City = ?, @State = ?, @Zip = ?}
  sql_add_phone     = %{insert into phonenumbers (recruitid, type, areacode, phonenumber, extension, source)
                        values                  (?,           ?,    ?,        ?,          ?,          ?)}
  # FIXME: This is not updating reports from too far ago, when a new doc comes in.
  # sql_upd_path      = %{update path_reports set recruitid = r.recruitid, vetted = 1
  #                     from path_reports as pr INNER JOIN recruits as r
  #                     on  pr.consumno = r.consumno
  #                     where pr.recruitid IS NULL AND
  #                     pr.colldt >= '#{LOOKBACK_PERIOD.days.ago.to_date.to_s}'
  #                   }

  sql_upd_path      = %{update path_reports set recruitid = r.recruitid, vetted = 1
                      from path_reports as pr INNER JOIN recruits as r
                      on  pr.consumno = r.consumno
                      where pr.recruitid IS NULL 
                    }

  our_newbies = %{select distinct consumno, mrn, report_type, p.pcp, d.condition from path_reports as p INNER JOIN docs as d on p.pcp = d.pracnum where vetted = 0 and colldt >= ? and d.treat_as_deleted = 0}

  noobs = mssql.select_all(our_newbies, LOOKBACK_PERIOD.days.ago)

  rev_req         = 'Path review required'
  rejected        = 'Path report REJECTED'
  accepted        = 'Path report ACCEPTED'
  prior_rejected  = 'Prior path report rejected'

  interesting_statuses = [rev_req, rejected, accepted, prior_rejected]
  statuses = Hash.new
  mssql.execute("select status, statusdescription from statuses where statusdescription in ('#{interesting_statuses.join("', '")}')").fetch do |stat|
    statuses[stat["statusdescription"]] = stat["status"]
  end

  # Supplying a value for statusdate b/c we are having a problem w/a single run inserting the same row multiple times.
  # This should cause the job to bomb if it tries to do that, since the PK will be violated.
  # Elaborating this so that a person w/2 reports, one accepted & one review-required won't show up twice
  # in the currentstatuses_vw, b/c they have 2 status records w/statudates = max(statusdate).
  now = DateTime.now
  now_val_accept = now.strftime('%Y-%m-%d %H:%M')
  now_val_review = (now + (1/1440.0)).strftime('%Y-%m-%d %H:%M')

  sql_insert_statuses_review_required = %{insert into RecruitStatuses(recruitid, status, statusdate)
  select distinct r.recruitid, #{statuses[rev_req]} as status, '#{now_val_review}' as statusdate
  from path_reports as pr INNER JOIN recruits as r
  on    pr.consumno = r.consumno
  where vetted = 0 AND
        review_requested = 'Y'}

  sql_insert_statuses_review_not_required = %{insert into RecruitStatuses(recruitid, status, statusdate)
  select distinct r.recruitid, #{statuses[accepted]} as status, '#{now_val_accept}' as statusdate
  from path_reports as pr INNER JOIN recruits as r
  on    pr.consumno = r.consumno
  where vetted = 0 AND
        review_requested = 'N'}

  # Altering this to screen out the short studyids of the phony data inserted in the create-database script.
  @next_studyid = mssql.select_one("select coalesce(max(studyid), 0) + 1 as nxt from recruits where len(studyid) > 3")[0]
  raise("Missing a status!") unless interesting_statuses.length == statuses.keys.length

  sth_add_recruit   = mssql.prepare(sql_add_recruit)
  sth_add_address   = mssql.prepare(sql_add_address)
  sth_add_phone     = mssql.prepare(sql_add_phone)
  sth_upd_path      = mssql.prepare(sql_upd_path)
  noobs.each do |path|
    num_considered += 1
    puts("Working on person #{path['consumno']}.")
    get.execute(path['consumno'])
    get.each do |recruit_info|
      # Is this person truly new?
      if mssql.select_one("select count(*) as num from recruits where consumno = '#{path['consumno']}'")["num"] > 0 then
        # Nope--not new.  Have we had a bite at them already?
        if mssql.select_one("select count(*) as num from recruits as r INNER JOIN recruitstatuses as rs on r.recruitid = rs.recruitid where r.consumno = '#{path['consumno']}' AND rs.status = #{statuses[accepted]}")["num"] > 0 then
          # yes--they have already been through this part of the study--leave them alone.
          num_already_in += 1
        else
          # Have not progressed beyond the path-report-identified stage.  Rehab if necessary.
          mssql.do("update recruitstatuses set status = #{statuses[prior_rejected]} where status = #{statuses[rejected]} and recruitid in (select recruitid from recruits where consumno = '#{path['consumno']}')")
          num_rehabbed += 1
        end
      else
        add_recruit(sth_add_recruit, recruit_info, path)
        num_added += 1
      end # if person already in recruits
      # get recruitid back out
      rid = mssql.select_one(sql_get_recruitid, path['consumno'])
      puts("RecruitID is #{rid}")
      # insert address(if new)
      add_address(mssql, sth_add_address, recruit_info, rid)
      # insert phone(if new)
      add_phone(mssql, sth_add_phone, recruit_info, rid)
    end # recruit info loop
  end # noobs loop

  # insert appropriate statuses for the new path reports
  puts("About to insert statuses for the new path reports")
  mssql.do(sql_insert_statuses_review_required)
  sleep(1)
  mssql.do(sql_insert_statuses_review_not_required)
  # update path report record w/recruitid & set vetted to 1.
  puts("About to update path reports w/recruitid & set vetted to 1.")
  mssql.do(sql_upd_path)

  mssql.commit
  puts("Changes committed to the db.")

  ret = %{There were #{num_considered} people attached to one of our docs.}
  if num_considered > 0 then
    ret += %{\nOf these, #{num_already_in} have had a prior path report accepted--so are either already in the study, or have already refused, etc.
    #{num_rehabbed} were in the tracking db, but have not yet had a path report accepted--so they are either pending review, or have had a path report rejected & are now back for reconsideration.
    #{num_added} entirely new people were added to the tracking database.}
  end
  ret
end


=begin
  So--we have the path reports of interest stored in path_reports, along with their PCPs.
  We need:
    - Check if the person is already in Recruits
      - if yes--were they rejected on the basis of a prior path report?
        - if yes
            - Replace their earlier 'Path Report REJECTED' status with a 'Prior Path Report REJECTED' status.
            - Add a 'Path report ACCEPTED' or 'Path review Required' status as necessary.
        - if not, copy their recruitid to the path report

    New info to gather:
    - consumno (b/c Survey wants it) (csr_dem)
    - StudyID (just copy recruitid?)
    - Full name (csr_id)
    - Residential address (csr_id.CSR_ADR_LN1 et seq.)
    - DOB (csr_dem)
    - Sex (csr_dem)

=end
def ditch_nonos(mssql)
  num_nonos = 0
  join_condition = %{from path_reports as p INNER JOIN
          CHSDwNoContact.dbo.nono as n
          on p.mrn = n.chsid}
  sql_count = %{select count(*) as num #{join_condition}}
  sql_ditch = %{delete from path_reports where id in (select id #{join_condition}) }
  num_nonos = mssql.select_one(sql_count)['num']
  if num_nonos > 0 then
    mssql.do(sql_ditch)
    "Removed #{num_nonos} reports for people on the NONO list.\n"
  else
    "None of the new path reports were for people who have opted out of GHRI research.\n"
  end
end

def ditch_prior_sufferers(mssql)

	basic_sql = %{from path_reports as p INNER JOIN
     prior_cancer_sufferers as c
on   p.mrn = c.mrn AND
     p.report_type = c.cancer_type}

	sql_count = %{select count(*) as num #{basic_sql} }

	sql_ditch = %{delete from path_reports where id in (select p.id #{basic_sql}) }

	num_with_priors = mssql.select_one(sql_count)['num']

	if num_with_priors > 0 then
		mssql.do(sql_ditch)
		"Removed #{num_with_priors} reports for people with records of prior breast/lung/colorectal tumors in SEER.\n"
	else
		"None of the new path reports were for people with records of prior breast/lung/colorectal tumors in SEER.\n"
	end
end

def main
  rep = ""
  hands = get_handlers

  mssql = DBI.connect(MSSQL_CONSTRING)

  begin
    num_reports = get_new_likelies(mssql, hands)
  rescue Exception => e
    num_reports = -1
    rep += "Troll Path PUKED AND DIED with a #{e.class} exception at the get_new_likelies() stage.  Details follow:\n"
    rep += e.to_s + "\n\n"
    rep += e.backtrace.join("\n")
  end

  rep += "There were a total of #{num_reports} new reports in the last #{LOOKBACK_PERIOD} days.\n"
  hands.each do |type, handler|
    rep += "\n" + type.upcase + "\n"
    rep += "  Reports inspected: #{handler.report_count}\n"
    rep += "  Number for people we would want in the study: #{handler.wanted_count}\n"
    rep += "  Number that should be human-reviewed: #{handler.review_requested_count}\n"
  end
  rep += "------------------------------\n\n"

  begin
    rep += ditch_prior_sufferers(mssql)
  rescue Exception => e
    rep += "Troll Path PUKED AND DIED with a #{e.class} exception at the ditch_prior_sufferers() stage.  Details follow:\n"
    rep += e.to_s + "\n\n"
    rep += e.backtrace.join("\n")
  end

  rep += "------------------------------\n\n"

  begin
    rep += ditch_nonos(mssql)
  rescue Exception => e
    rep += "Troll Path PUKED AND DIED with a #{e.class} exception at the ditch_nonos() stage.  Details follow:\n"
    rep += e.to_s + "\n\n"
    rep += e.backtrace.join("\n")
  end

  rep += "------------------------------\n\n"

  syb = DBI.connect(SYBASE_CONSTRING)
  begin
    get_pcps(mssql, syb)
  rescue Exception => e
    rep += "Troll Path PUKED AND DIED with a #{e.class} exception at the get_pcps() stage.  Details follow:\n"
    rep += e.to_s + "\n\n"
    rep += e.backtrace.join("\n")
  end

  begin
    rep += vet_newbies(mssql, syb)
  rescue Exception => e
    rep += "Troll Path PUKED AND DIED with a #{e.class} exception at the vet_newbies() stage.  Details follow:\n"
    rep += e.to_s + "\n\n"
    rep += e.backtrace.join("\n")
  end

  mssql.disconnect
  syb.disconnect

  puts(rep)

  rep += "\n\n\n Need to see what needs doing?  Check the to-do list:\nhttp://ctrhs-devnet2/pardre1/OncoNurse/"

  FeedHelper.send_mail(rep, "OncoNurse: Path Troll Report", %w(pardee.r@ghc.org kirlin.b@ghc.org miyoshi.j@ghc.org))
  # FeedHelper.send_mail(rep, "OncoNurse: Path Troll Report", %w(pardee.r@ghc.org))
end

def just_vet_newbies
  mssql = DBI.connect(MSSQL_CONSTRING)
  syb = DBI.connect(SYBASE_CONSTRING)
  puts(vet_newbies(mssql, syb))
end

strt = Time.now
STDOUT.sync = true
main
# just_vet_newbies
elapsed_seconds = Time.now - strt
puts("Finished! (in #{elapsed_seconds} seconds)")
