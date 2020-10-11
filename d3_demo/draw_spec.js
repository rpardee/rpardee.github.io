const spec_cols = [
  {label: "Column Name", format: d => d.name, class:"norm"},
  {label: "Definition", format: d => d.definition, class:"norm"},
  {label: "Type(length)", format: d => d.type + "(" + d.length + ")", class:"norm"},
  {label: "Valid Values", format: d=> format_vallists(d.valid_values), class:"norm"},
  {label: "Implementation Guidelines", format: d=> format_igs(d.implementation_guidelines), class:"hideable"}
  ]
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
function format_vallists(inarr) {
  // receives arrays of objects w/"value" and "meaning keys". Or else plain string descriptions.
  // console.log(Array.isArray(inarr)) ;
  if (Array.isArray(inarr)) {
    retval = "<dl>" ;
    inarr.forEach(d => {
      retval += "<dt>" + d.value + "</dt>"
      retval += "<dd>" + d.meaning + "</dd>"
    })
    retval += "</dl>" ;
  } else {retval = inarr}
  return retval ;
}
async function draw_spec(spec_name, with_igs = true) {
  all_specs = await d3.json('./specs.json') ;
  spec = all_specs[spec_name] ;
  our_cols = spec_cols ;
  if (!with_igs) {our_cols.pop()} ;

  wrapper = d3.select("#wrapper") ;
  wrapper.append("h1").text(spec.name) ;
  wrapper.append("p").text(spec.description) ;
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
        .html(column => column.format(d))
    ;
  }) ;
  wrapper.append("h2").text("Primary Key: " + spec.primary_key) ;
  wrapper.append("h2").text("Comments") ;
  spec.comments.forEach((cmt, ind) => {
    wrapper.append("h3").text((ind + 1) + ": " + cmt.title) ;
    wrapper.append("p").html(cmt.comment) ;
  }) ;

}

