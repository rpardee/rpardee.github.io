
async function draw_legend() {

  legEntries = {
    hcsrn: {"text": "State in which HCSRN Research Centers Are Based"},
    affiliated: {"text": "Research Communities Affilated with HCRSN members"}
  }

  const wrapper = d3.select('#wrapper')
    .append('svg')
    .attr("width", 600)
    .attr("height", 200)
  ;
  const legGroup = wrapper.append("g") ;

  var y = 3 ;
  var sqSide = 30 ;

  for(var entry in legEntries) {
    thisEntry = legEntries[entry] ;
    legGroup.append("rect")
      .attr("x", 5)
      .attr("y", y)
      .attr("height", sqSide)
      .attr("width" , sqSide)
      .attr("class", entry)
    ;
    legGroup.append("text")
      .attr("x", 5 + sqSide + 5)
      .attr("y", y + sqSide - 8)
      // .attr('text-anchor', 'end')
      .text(thisEntry.text)
    ;

    y *= 12 ;
    console.log(thisEntry) ;
  }

}

draw_legend() ;