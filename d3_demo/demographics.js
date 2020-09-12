const spec_cols = [
  {label: "Column Name", format: d => d.name},
  {label: "Definition", format: d => d.definition},
  {label: "Type(length)", format: d => d.type + "(" + d.length + ")"},
  {label: "Valid Values", format: d=> format_vallists(d.valid_values)},
  {label: "Implementation Guidelines", format: d=> d.implementation_guidelines}
  ]
function format_vallists(inarr) {
  // receives arrays of objects w/"value" and "meaning keys". Or else plain string descriptions.
  console.log(Array.isArray(inarr)) ;
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
async function draw_spec(specdata_json) {
  spec = await d3.json(specdata_json) ;
  wrapper = d3.select("#wrapper") ;
  wrapper.append("h1").text(spec.name) ;
  wrapper.append("p").text(spec.description) ;
  wrapper.append("h2").text("Standard Variable: " + spec.stdvar) ;
  wrapper.append("h2").text("Columns") ;
  wrapper.append("table")
    .attr("id", "col-tab")
    .append("thead")
    .append("tr")
    .selectAll("thead")
    .data(spec_cols)
    .enter().append("th")
      .text(d => d.label)
  ;
  const coltab = d3.select("#col-tab") ;
  const tbody = coltab.append("tbody") ;
  spec.columns.forEach(d => {
    tbody.append("tr")
      .selectAll("td")
      .data(spec_cols)
      .enter().append("td")
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

draw_spec('./demographics.json') ; 