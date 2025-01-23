const spec_cols = [
  {label: "Column Name"               , id: d => `${d.name}-cn`, format: d => d.name                                 , tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d)},
  {label: "Definition"                , id: d => `${d.name}-df`, format: d => d.definition                           , tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d)},
  {label: "Type (length)"             , id: d => `${d.name}-tl`, format: d => format_typelens(d.type, d.length)      , tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d)},
  {label: "Valid Values"              , id: d => `${d.name}-vv`, format: d => format_vallists_vf(d)                  , tfunc: (d) => tdTitle(d, true) , cfunc: (d) => tdClass(d, true), onclick: vv_click},
  {label: "Implementation Guidelines" , id: d => `${d.name}-ig`, format: d => format_igs(d.implementation_guidelines), tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d, false, "hideable")}
  ]

function tdClass(d, isValidValues = false, defaultClass = "norm") {
  // console.log(d) ;
  if (isValidValues && Array.isArray(d.valid_values)) {
    return "clickable" ;
  }
  return defaultClass ;
}

function tdTitle(d, isValidValues = false) {
  if (isValidValues && Array.isArray(d.valid_values)) {
    return "Click to copy a SAS format statement to your clipboard" ;
  }
  return "" ;
}

function vv_click(datum) {
  // console.log(datum) ;
  if (Array.isArray(datum.valid_values)) {
    const clipText = createFormat(datum) ;
    navigator.clipboard.writeText(clipText).then(function() {
      const notification = d3.select("#notification") 
        .text(`SAS format statement ${datum.name} copied to clipboard`)
        .attr("class", "show")
      ;
      setTimeout(function(){notification.attr("class", "")}, 3000);
      }, function() {
        console.log("boo!") ;
      })    
  }
}

function headerClick(event) {
  // alert('boobies') ;
  if (d3.selectAll(".hidden").empty()) {
    //nothing is hidden--do the hiding
    d3.selectAll(".hideable")
      .attr('class', 'hidden') ;
  } else {
    d3.selectAll(".hidden")
      .attr('class', 'hideable') ;
    }
}
function format_igs(inarr) {
  if (Array.isArray(inarr)) {
    retval = "" ;
    inarr.forEach(ig => {
      retval += "<p>" + ig + "</p>"
    })
  } else {retval = inarr}
  return retval ;
}
function format_typelens(intyp, inlen) {
  if (intyp) {
    typ = intyp ;
    if (inlen) {len = inlen} else {len = '*'} ;
    return typ + "(" + len + ")" ;
  } else {
    return '' ;
  } ;
}
function createFormat(colspec) {
  let retval = ''   ;
  if (Array.isArray(colspec.valid_values)) {
    retval = `value ${makeFormatName(colspec)}` ;
    colspec.valid_values.forEach(d => {
      retval += "\n  '" + d.value + "' = '" + d.meaning + "'"
    })
    retval += "\n;\n" ;
  }
  return retval ;
}

function format_vallists_vf(colspec) {
  if (Array.isArray(colspec.valid_values)) {
    retval = "<dl class = 'dl'>" ;
    colspec.valid_values.forEach(d => {
      retval += "<dt>" + d.value + "</dt>"
      retval += "<dd>" + d.meaning + "</dd>"
    })
    retval += "</dl>" ;
  } else {retval = colspec.valid_values}
  return retval ;
}
function makeFormatName(d) {
  // console.log(d) ;
  retval = d.type == "char" ? "$" : "" ;
  retval += d.name.split('-')[0].replace(/[0-9]/g, '').toLowerCase() ;
  return retval.substr(0, 31) ;
}
async function draw_spec(spec_name, with_igs = true) {
  all_specs = await d3.json('./specs.json') ;
  spec = all_specs[spec_name] ;
  our_cols = spec_cols ;
  if (!with_igs) {our_cols.pop()} ;

  wrapper = d3.select("#wrapper") ;
  wrapper.attr("class", "vdw-spec") ;
  wrapper.append("div").attr("id", "admonition")
    .append("p").text("Provided as a convenience--this is NOT an official spec.")
  ;
  wrapper.append("div").attr("id", "notification") ;
  wrapper.append("h1").text(spec.name) ;
  wrapper.append("p").html(spec.description) ;
  wrapper.append("h2").text("Standard Variable: " + spec.stdvar) ;
  wrapper.append("h2").text("Columns") ;
  wrapper.append("table")
    .attr("id", "col-tab")
    .append("thead")
      .attr("title", "(Click to toggle display of the Implementation Guidelines)")
    .append("tr")
    .selectAll("thead")
    .data(spec_cols)
    .enter().append("th")
      .text(d => d.label)
      .on("click", headerClick)
      .attr("class", d => d.cfunc(d))
  ;
  const coltab = d3.select("#col-tab") ;
  const tbody = coltab.append("tbody") ;
  spec.columns.forEach(d => {
    tbody.append("tr")
      .selectAll("td")
      .data(spec_cols)
      .enter().append("td")
        .attr("class", column => column.cfunc(d))
        .attr("title", column => column.tfunc(d))
        .attr("id", column => column.id(d))
        .html(column => column.format(d))
        .on("click", column => column.onclick === undefined ? null : column.onclick(d))
    ;
  }) ;

  wrapper.append("h2").text("Primary Key: " + spec.primary_key) ;
  wrapper.append("h2").text("Comments") ;
  spec.comments.forEach((cmt, ind) => {
    wrapper.append("h3").text((ind + 1) + ": " + cmt.title) ;
    wrapper.append("p").html(cmt.comment) ;
  }) ;

}

