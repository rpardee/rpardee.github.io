affiliatedStates = ['ND', 'KS', 'NE', 'AR', 'TN', 'KY', 'OH'] ;
hcsrnStates = []

function getStates(hcsrnSiteArray) {
  ret = new Set() ;
  for (var i = hcsrnSiteArray.length - 1; i >= 0; i--) {
    for (var j = hcsrnSiteArray[i].states.length - 1; j >= 0; j--) {
      ret.add(hcsrnSiteArray[i].states[j]) ;
    }
  }
  hcsrnStates = Array.from(ret) ;
  return Array.from(ret) ;
}

function getStateClass(inState) {
  if (hcsrnStates.includes(inState)) {return 'hcsrn'} else {
    if (affiliatedStates.includes(inState)) {return 'affiliated'} else {
      return 'unaffiliated' ;
    }
  }
}

async function draw_legend(legGroup) {

  legEntries = {
    hcsrn: {"text": "State in which HCSRN Research Centers Are Based"},
    affiliated: {"text": "Research Communities Affilated with HCRSN members"}
  }

  var y = 3 ;
  var sqSide = 20 ;

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
    // console.log(thisEntry) ;
  }
}

function does_this_ever_get_called(d) {
  console.log('dtegc:', d) ;
}

async function drawMap() {
  const stateShapes = await d3.json("./ne_110m_admin_1_states_provinces.json") ;
  const overviewData = await d3.json("./overview_data.json") ;
  const hcsrnSiteArray = overviewData["sites"] ;
  hcsrnStates = getStates(hcsrnSiteArray) ;

  hcsrnSites = {} ;
  hcsrnSiteArray.map((d) => hcsrnSites[d.abbr] = d) ;

  console.log(hcsrnSiteArray) ;

  const stateNameAccessor = (d) => d.properties["gn_name"] ;
  const stateAbbrAccessor = (d) => d.properties.postal ;
  const latLongAccessor = (d) => [d.longitude, d.latitude] ;

  let dimensions = {
    width: window.innerWidth * 0.7,
    margin: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10
    }
  } ;
  dimensions.boundedWidth = dimensions.width - dimensions.margin.right - dimensions.margin.left ;
  dimensions.boundedHeight = window.innerHeight * 0.9 ;
  dimensions.height = dimensions.boundedHeight + dimensions.margin.top + dimensions.margin.bottom ;

  const projection = d3.geoAlbersUsa()
     .translate([dimensions.width/2, dimensions.height/2])    // translate to center of screen
     .scale([1000]);          // scale things down so see entire US
  ;

  const path = d3.geoPath(projection) ;

  const wrapper = d3.select("#wrapper")
    .append("svg")
    .attr("width", dimensions.width)
    .attr("height", dimensions.height)
  ;

  const bounds = wrapper.append("g")
    .style("transform", `translate(${dimensions.margin.left}px, ${dimensions.margin.top}px)`)
  ;

  // draw the state shapes (svg paths)
  const states = bounds.selectAll('path')
    .data(stateShapes.features)
    .enter().append("path")
    .attr("class", (d) => getStateClass(stateAbbrAccessor(d)))
    .attr("id", stateAbbrAccessor)
    // .attr("d", path(stateShapes)) WRONG!
    .attr("d", path) // equiv to: (d) => path(d)
  ;

  // draw the research centers
  const researchCenters = bounds.selectAll("circle")
    .data(hcsrnSiteArray)
    .enter().append("circle")
      .attr("class", "research-center")
      .attr("id", (d) => d.abbr)
      .attr("cx", (d) => projection(latLongAccessor(d))[0])
      .attr("cy", (d) => projection(latLongAccessor(d))[1])
      .attr("r", 8)
      .attr("fill", "gold")
  ;

  researchCenters.on("mouseenter", onMouseEnter).on("mouseleave", onMouseLeave) ;
  const tooltip = d3.select("#tooltip") ;
  function onMouseEnter(datum) {
    tooltip.style("opacity", 1) ;
    tooltip.select("#name").text(datum.name) ;
    tooltip.select("#location").text("Location: " + datum.location) ;
    tooltip.select("#sdm").text("Site Data Manager: " + datum.manager) ;
    tooltip.style("left", (d3.event.pageX) + "px")
      .style("top", (d3.event.pageY - 28) + "px");

  }

  function onMouseLeave(datum) {
    tooltip.style("opacity", 0) ;
  }

  // TODO: Work out how to place this reasonably.
  const legendGroup = wrapper.append("g")
    .attr("transform", `translate(${
      380
    }, ${
      dimensions.width < 800
      ? dimensions.boundedHeight - 3
      : dimensions.boundedHeight * 0.05
    })`)
  ;
  draw_legend(legendGroup) ;
}

drawMap() ;