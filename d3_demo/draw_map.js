affiliatedStates = ['ND', 'KS', 'NE', 'AR', 'TN', 'KY', 'OH'] ;
hcsrnStates = []

function getStates(hcsrnSites) {
  ret = new Set() ;
  for (var i = hcsrnSites.length - 1; i >= 0; i--) {
    for (var j = hcsrnSites[i].states.length - 1; j >= 0; j--) {
      ret.add(hcsrnSites[i].states[j]) ;
    }
  }
  hcsrnStates = Array.from(ret) ;
  return Array.from(ret) ;
}

function getStateClass(inState) {
  if (hcsrnStates.includes(inState)) {return 'hcsrn'} else {
    if (affiliatedStates.includes(inState)) {return 'affiliated'} else {
      return '' ;
    }
  }
}

// function setStateFill(statshap_feature, hcsrnStates) {
//   // console.log(statshap_feature.properties.postal, hcsrnStates.includes(statshap_feature.properties.postal)) ;
//   if (hcsrnStates.includes(statshap_feature.properties.postal)) {return "lightblue"} else {return "pink"}
// }

async function drawMap() {
  const stateShapes = await d3.json("./ne_110m_admin_1_states_provinces.json") ;
  const overviewData = await d3.json("./overview_data.json") ;
  const hcsrnSites = overviewData["sites"] ;
  var hcsrnStates = getStates(hcsrnSites) ;

  const stateNameAccessor = (d) => d.properties["gn_name"] ;
  const stateAbbrAccessor = (d) => d.properties.postal ;

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
     .scale([dimensions.width]);          // scale things down so see entire US
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

  const states = bounds.selectAll('path')
    .data(stateShapes.features)
    .enter().append("path")
    .attr("class", (d) => getStateClass(stateAbbrAccessor(d)))
    .attr("id", stateAbbrAccessor)
    // .attr("d", path(stateShapes)) WRONG!
    .attr("d", path) // equiv to: (d) => path(d)
  ;

  // console.log(stateShapes) ;

}

drawMap() ;