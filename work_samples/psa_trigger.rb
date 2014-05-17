=begin 
  psa_trigger.rb
  Roy Pardee
  pardee.r@ghc.org
  Copyright Group Health Cooperative 1-jun-2013.  All rights reserved
=end

=begin

  PSA-indicating procedures.
  PROC_ID   proc_name                                   PROC_CODE frq
  15449     PSA                                         84153.002 344445
  15448     FREE PSA                                    84153.001   5069
  15451     FPSA BATTERY COMPLETION (PAML)              84153.004     18
  10122     PSA TOTAL SCREENING                         G0103          4
  15450     PSA ULTRASENSITIVE (PAML)                   84153.003      3
  31641     PSA FREE (INCLUDES TOTAL) (OVL)             PSAF           3
  58096     CMPA+LIPID+CBC+TSH.R+PSA+UAXM+CULIF (PAML)  PA2005C        3
  6450      PROSTATE SPECIFIC ANTIGEN (PSA);COMPLEX     84152          1

  19630     PSA, POST RADICAL PROSTATECTOMY (PAML)      84153.005      4
  32816     IS A PSA TEST RIGHT FOR YOU? (DVD)          PE571          2


  PSA-excusing conditions.
  dx_id   dx_name                                             frq
  1726    Malignant neoplasm of prostate                      171
  76220   Prostate cancer                                      98
  10147   Elevated prostate specific antigen (PSA)             61
  93159   Elevated PSA                                         55
  14563   Personal history of malignant neoplasm of prostate   53
  174793  Personal history of prostate cancer                  30
  234242  History of prostate cancer                           22
  10147   790.93  Elevated prostate specific antigen (PSA) 12
  103038  198.5   Bone metastases 6
  112096  185     CA - cancer of prostate 1
  121961  185     Prostate ca 3
  14563   V10.46  Personal history of malignant neoplasm of prostate 1
  150329  600.1   Prostate nodule 5
  168484  V76.44  Prostate cancer screening 8
  176121  790.93  Abnormal PSA 1
  19341   600.91  Unspecified hyperplasia of prostate with urinary obstruction and other lower urinary tract symptoms (LUTS) 1
  196284  599.72  Microscopic hematuria 1
  196750  780.64  Chills (without fever) 1
  216517  185     Prostate cancer, primary, with metastasis from prostate to other site 1
  234242  V10.46  History of prostate cancer 2
  237068  596.89  Bladder mass 1
  238495  602.9   Prostate mass 1
  261338  185     Recurrent prostate adenocarcinoma 5
  272244  V10.46  Hx of prostatic malignancy 1
  273113  185     Cancer of prostate w/med recur risk (T2b-c or Gleason 7 or PSA 10-20) 1
  279122  790.93  PSA elevation 2
  279295  602.8   Prostate asymmetry 1
  299466  600     BPH with elevated PSA 1
  338555  V13.89  History of elevated PSA 2
  346813  V10.46  H/O prostate cancer 1
  347547  198.5   Metastatic adenocarcinoma to bone 1
  350828  790.93  Elevated PSA, less than 10 ng/ml 1
  76220   185     Prostate cancer 5
  76577   185     Adenocarcinoma of prostate 4
  78461   185     Carcinoma of prostate 1
  93159   790.93  Elevated PSA 10


=end
require "tiny_tds"
require "net/smtp"
require "sqlite3"
require 'active_support/all'


LOG_DB      = "//server/choose_wisely/programs/psa_trigger.db"
SMTPSERVER  = "mailhost.mycompany.com"
SMTPPORT    = 25
SMTPDOMAIN  = "server.mycompany.com"

class BadPSA
  attr_accessor :consumno, :pat_id, :pat_initials, :order_datetime, :order_status, :doc, :encounter_id, :age
  @@logdb = SQLite3::Database.new(LOG_DB)

  EXCUSING_PROBLEMS = [1726, 76220, 10147, 93159, 14563, 174793, 234242,
                        10147, 103038, 112096, 121961, 14563, 150329, 168484,
                        176121, 19341, 196284, 196750, 216517, 234242, 237068,
                        238495, 261338, 272244, 273113, 279122, 279295,
                        299466, 338555, 346813, 347547, 350828, 76220,
                        76577, 78461, 93159, 392172]
  PSA_PROCIDS       = [15449, 15448, 15451, 10122, 15450, 31641, 58096, 6450]

  def self.excuses
    EXCUSING_PROBLEMS.join(', ')
  end

  def self.proc_ids
    PSA_PROCIDS.join(', ')
  end

  def self.create_logdb
    @@logdb.execute("drop table already_reported")
    @@logdb.execute("create table already_reported (
                    pat_enc_csn_id int PRIMARY KEY
                    , date_reported numeric NOT NULL
                   ) ")
  end
  def self.reset_logdb
    @@logdb.execute("delete from already_reported")
  end

  def self.format_list(psas)

    heads = {:consumno       => "Patient Consumer Number",
            :age            => "Patient Age",
             :pat_initials   => "Patient Initials",
             :order_datetime => "Order Date",
             :order_status   => "Order Status",
             :doc            => "Ordering Provider"}

    rowcount = 0

    cellstyle = "style='border:1px solid black;padding:5px;'"

    ret = "<table style='border-collapse:collapse;border:1px solid black;'><tr>"
    heads.each_value do |h|
      ret += "<th #{cellstyle}><font face=Tahoma>#{h}</font></th>"
    end
    ret += "</tr>\n"
    psas.each do |p|
      rowcount = 1 - rowcount
      st = "style = 'background-color:Lavender'" if rowcount == 1
      ret += "<tr #{st}>"
      heads.each_key do |k|
        val = p.send(k)
        case k
        when :doc
          val = val.titleize
        when :order_datetime, :prior_order
          # val = DateTime.parse(val).to_formatted_string(:long)
          val = val.to_formatted_s(:long) if val
        end
        ret += "<td #{cellstyle}><font face=Tahoma>#{val}</font></td>"
      end
      ret += "</tr>\n"
    end
    ret += "</table>\n"
    return ret
  end

  def self.record_list(list)
    list.each do |p|
      p.record
    end
  end

  def initialize(encounter_id = nil, consumno = nil, pat_id = nil, pat_initials = nil, order_datetime = nil, order_status = nil, doc = nil, age = nil)
    @consumno       = consumno
    @pat_id         = pat_id
    @pat_initials   = pat_initials
    @order_datetime = order_datetime
    @order_status   = order_status
    @doc            = doc
    @encounter_id   = encounter_id
    @age            = age
  end

  def excused?(clardb)
    ret = false
    sql = "select pl.dx_id, d.dx_name, pl.problem_cmt
                      from problem_list as pl INNER JOIN
                           clarity_edg as d
                      on    pl.dx_id = d.dx_id
                       where pat_id = '#{@pat_id}' AND
                       pl.dx_id in (#{BadPSA.excuses}) AND
                       problem_status_c = 1"

    # puts(sql)
    r = clardb.execute(sql)
    r.each do |x|
      ret = true
      puts("Found excuse: #{x['dx_name']}")
    end
    return ret
  end
  def on_testosterone?(clardb)
    ret = false
    sql = "select description
          from ORDER_MED
          where description like '%testosterone%' AND
          START_DATE > DATEADD(month, -3, getdate()) AND
          coalesce(END_DATE, getdate()) >= GETDATE() AND
          pat_id = '#{@pat_id}'"
    res = clardb.execute(sql)
    res.each do |o|
      # puts(o)
      puts("Found a current (?) order for #{o['description']}")
      ret = true
    end
    return ret
  end
  def already_reported?
    @@logdb.get_first_value("select count(*) as num_reports
                            from already_reported
                            where pat_enc_csn_id = #{@encounter_id}") > 0
  end
  def record
    puts("About to record encounter_id #{@encounter_id}")
    @@logdb.execute("insert into already_reported (pat_enc_csn_id, date_reported) values (#{@encounter_id}, datetime('now', 'localtime'))")
  end
end

def send_mail(body, subject, recipients, from = "pardee.r@ghc.org", logfile = nil)
  # puts "Pretend I sent mail to " + recipients.join + " with subject: " + subject + " and body " + body
message = <<MESSAGE_END
From: Inappropriate PSA Trigger tool <#{from}>
To: #{recipients.join('; ')}
MIME-Version: 1.0
Content-type: text/html
Subject: #{subject}

#{body}
<p>Produced by #{File.expand_path($0)}.</p>
MESSAGE_END

  Net::SMTP.start(SMTPSERVER, SMTPPORT, SMTPDOMAIN) do |smtp|
    body = "subject: #{subject} \n" +
          "to: " + recipients.join("; ") + "\n" * 2 +
          "MIME-Version: 1.0\n" +
          "Content-type: text/html\n" +
          body.to_s
    body +=  "\n"*2 + "Full details in " + logfile.gsub("/", "\\") if logfile

    smtp.send_message(message, from, recipients)
  end
end
def age(dob, age_on)
  age_on.year - dob.year - ((age_on.month > dob.month || (age_on.month == dob.month && age_on.day >= dob.day)) ? 0 : 1)
end

def get_bad_psas(lookback, db)
  cands = []
  ret = []
  sql = "select distinct p.PAT_ID, p.PAT_MRN_ID as consumno
                , substring(p.PAT_first_NAME, 1, 1) + substring(p.PAT_last_NAME, 1, 1) as pat_initials
                , p.BIRTH_DATE
                , o.ORDER_TIME
                , o.pat_enc_csn_id as encounter_id
                , zs.NAME as order_status
                , DATEDIFF(year, p.birth_date, o.ORDER_TIME) as approximate_age
              , d.PROV_NAME as ordering_doc
          from ORDER_PROC as o INNER JOIN
               PATIENT as p
          on  o.PAT_ID = p.PAT_ID INNER JOIN
              CLARITY_SER as d
          on  o.AUTHRZING_PROV_ID = d.PROV_ID INNER JOIN
              ZC_ORDER_STATUS as zs
          on  o.ORDER_STATUS_C = zs.ORDER_STATUS_C LEFT JOIN
              ORDER_DX_PROC as dx
          on  o.ORDER_PROC_ID = dx.ORDER_PROC_ID
        where o.proc_id in (#{BadPSA.proc_ids})
              and o.order_time between dateadd(d, -#{lookback}, getdate()) and getdate() and
              o.FUTURE_OR_STAND is null and
              o.ORDER_STATUS_C in (1, 2, 3, 5) AND
              DATEDIFF(year, p.birth_date, o.ORDER_TIME) > 74 AND
              coalesce(dx.DX_ID, -2) not in (#{BadPSA.excuses})"
  res = db.execute(sql)
  res.each do |r|
    actual_age = age(r['BIRTH_DATE'], r['ORDER_TIME'])
    if actual_age > 75 then
      cands << BadPSA.new(r['encounter_id'],
                        r['consumno']    ,
                        r['PAT_ID']      ,
                        r['pat_initials'],
                        r['ORDER_TIME']  ,
                        r['order_status'],
                        r['ordering_doc'],
                        actual_age)
    end
  end
  cands.each do |p|
    ret << p unless p.already_reported? or p.excused?(db) or p.on_testosterone?(db)
    # ret << p unless p.excused?(db) or p.on_testosterone?(db)
  end
  ret
end

def main
  psas = []
  lookback = 4
  subject = "Inappropriate PSA Orders in prior #{lookback} days: "
  body = ""
  recipients = %w(pardee.r@ghc.org handley.m@ghc.org)
  # recipients = %w(pardee.r@ghc.org)
  begin
    puts("beginning...")
    db = TinyTds::Client.new(:dataserver => 'EpClarity_RPT:1433', :database => 'clarity', :timeout => 60)
    psas += get_bad_psas(lookback, db)
  rescue Exception => e
    if db then
      db.close unless db.closed?
    end
    subject += "PUKED AND DIED!!! (#{e.message})"
    body += e.backtrace.join("<br/>/n")
    send_mail(body = body, subject = subject, recipients = %w(pardee.r@ghc.org))
    raise e
  else
    puts("No errors!")
    db.close
  end
  if psas.length > 0 then
    subject += "#{psas.length} possibles"
    body += BadPSA.format_list(psas)
  else
    subject += "NONE FOUND (EOM)" unless subject.match(/PUKED/)
  end

  send_mail(body = body, subject = subject, recipients = recipients)
  BadPSA.record_list(psas)
end

# BadPSA.reset_logdb
main

puts("Finished!")