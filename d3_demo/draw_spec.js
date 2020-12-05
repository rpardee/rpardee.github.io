const spec_cols = [
  {label: "Column Name"               , id: d => `${d.name}-cn`, format: d => d.name                                    , class:"norm"},
  {label: "Definition"                , id: d => `${d.name}-df`, format: d => d.definition                              , class:"norm"},
  {label: "Type(length)"              , id: d => `${d.name}-tl`, format: d => format_typelens(d.type, d.length)         , class:"norm"},
  {label: "Valid Values"              , id: d => `${d.name}-vv`, format: d => format_vallists_vf(d), class:"norm-vv"},
  {label: "Implementation Guidelines" , id: d => `${d.name}-ig`, format: d => format_igs(d.implementation_guidelines)   , class:"hideable"}
  ]

function vv_click(datum) {
  clickedCell = `td#${datum.name}-vv` ;
  td = d3.select(clickedCell) ;
  currentClass = td._groups[0][0].className ;
  console.log(currentClass) ;
  td.attr("class", currentClass == "format-vv" ? "norm-vv" : "format-vv") ;
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
function format_vallists_vf(colspec) {
  // Writes a SAS format value statement for an input array of valid values
  // console.log(Array.isArray(inarr)) ;
  if (Array.isArray(colspec.valid_values)) {
    retval = `<pre class = 'fmt'>value ${makeFormatName(colspec)}` ;
    colspec.valid_values.forEach(d => {
      retval += "\n  '" + d.value + "' = '" + d.meaning + "'"
    })
    retval += "\n;</pre>" ;
    retval += "<dl class = 'dl'>" ;
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
  wrapper.append("h1").text(spec.name) ;
  wrapper.append("p").html(spec.description) ;
  wrapper.append("h2").text("Standard Variable: " + spec.stdvar) ;
  wrapper.append("h2").text("Columns") ;
  wrapper.append("table")
    .attr("id", "col-tab")
    .append("thead")
      .attr("title", "(click to toggle display of IGs)")
    .append("tr")
    .selectAll("thead")
    .data(spec_cols)
    .enter().append("th")
      .text(d => d.label)
      .on("click", headerClick)
      .attr("class", d => d.class)
  ;
  ;
  const coltab = d3.select("#col-tab") ;
  const tbody = coltab.append("tbody") ;
  spec.columns.forEach(d => {
    tbody.append("tr")
      .selectAll("td")
      .data(spec_cols)
      .enter().append("td")
      .attr("class", d => d.class)
      .attr("id", column => column.id(d))
      .html(column => column.format(d))
      .on("click", () => vv_click(d))
    ;
  }) ;

  wrapper.append("h2").text("Primary Key: " + spec.primary_key) ;
  wrapper.append("h2").text("Comments") ;
  spec.comments.forEach((cmt, ind) => {
    wrapper.append("h3").text((ind + 1) + ": " + cmt.title) ;
    wrapper.append("p").html(cmt.comment) ;
  }) ;

}

