affiliatedStates = ['ND', 'KS', 'NE', 'AR', 'TN', 'KY', 'OH'] ;
hcsrnStates = []

async function drawImplementations(overviewData, site_abbr, draw_div) {

  // key_specs = ["demog", "enrl", "ute-enc", "rx", "tumor", "vitals", "soc", "death", "lab"] ;
  key_specs = {
    "demog": "Demographics",
    "enrl": "Enrollments",
    "ute-enc": "Utilization",
    "rx": "Rx Fills",
    "lab": "Lab Results",
    "vitals": "Vital Signs",
    "soc": "Social History",
    "death": "Death",
    "tumor": "Tumor"
  }

  spec_order = {
    "demog": 1,
    "enrl": 2,
    "ute-enc": 3,
    "rx": 4,
    "lab": 5,
    "vitals": 6,
    "soc": 7,
    "death": 8,
    "tumor": 9
  }

  // console.table(key_specs) ;

  implementations = overviewData["implementations"].filter((d) => d["site"] == site_abbr && d["data area"] in key_specs).map((d) => {
    if (d.end_year === undefined) {
      // do nothing
    } else {
      if (d.end_year == 'Present') {d.end_year = new Date().getFullYear()} ;
      if (Number.isInteger(d.end_year)) {
        ey = d.end_year
      } else {
        ey = Number(d.end_year.match('\\d{4}')) ;
      }
      ;
      if (Number.isInteger(d.start_year)) {
        sy = d.start_year
      } else {
        sy = Number(d.start_year.match('\\d{4}')) ;
      }
      ;
      if (sy == 0) {sy = undefined} ;
      if (ey == 0) {ey = undefined} ;
      d.end_year = ey ;
      d.start_year = sy ;
    }
    return d ;
  })
  ;

  // console.log(implementations) ;

  yAccessor = (d) => key_specs[d["data area"]] ;

  function sortImp(a, b) {
    if (spec_order[a["data area"]] < spec_order[b["data area"]]) return -1 ;
    if (spec_order[a["data area"]] > spec_order[b["data area"]]) return  1 ;
    return 0 ;
  }

  implementations = implementations.sort(sortImp) ;

  let dimensions = {
    width: 400,
    height: 200,
    margin: {
      top: 5,
      right: 15,
      bottom: 40,
      left: 20,
    },
  }
  dimensions.boundedWidth = dimensions.width
    - dimensions.margin.left
    - dimensions.margin.right
  dimensions.boundedHeight = dimensions.height
    - dimensions.margin.top
    - dimensions.margin.bottom

  draw_div.selectAll("svg").remove() ;

  const svg = draw_div.append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
  ;
  const bounds = svg.append("g")
      .style("transform", `translate(${
        dimensions.margin.left
      }px, ${
        dimensions.margin.top
      }px)`)
  ;
  const xScale = d3.scaleLinear()
    .domain(d3.extent(implementations.map((d) => [d.start_year, d.end_year]).flat()))
    .range([0, dimensions.boundedWidth])
    .nice()
  ;

  const yScale = d3.scaleBand()
    // .domain(implementations.map((d) => d.site))
    .domain(implementations.map((d) => yAccessor(d)))
    .rangeRound([0, dimensions.boundedHeight])
    .padding(0.1)
    ;

  const rects = bounds.selectAll("rect")
    .data(implementations)
    .enter().append("rect")
      .attr("x", (d) => xScale(d.start_year))
      .attr("y", (d) => yScale(yAccessor(d)))
      // .attr("y", (d) => yScale(d.site))
      .attr("width", (d) => xScale(d.end_year) - xScale(d.start_year))
      .attr("height", yScale.bandwidth())
      // .attr("fill", "cornflowerblue")
  ;

  // draw peripherals
  const xAxisGenerator = d3.axisBottom()
    .scale(xScale)
      .tickFormat(d3.format("d"))
  ;
  const xAxis = bounds.append("g")
    .call(xAxisGenerator)
      .style("transform", `translateY(${dimensions.boundedHeight}px)`)
  ;

  const yAxisGenerator = d3.axisRight()
    .scale(yScale)
    // .tickValues(implementations.map((d) => d.site))
  ;

  const yAxis = bounds.append("g")
    .call(yAxisGenerator)
    // .style("transform", `translateX(${dimensions.boundedWidth}px)`)
  ;

  // console.table(implementations) ;
}

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

async function drawMap() {
  const stateShapes = await d3.json("./ne_110m_admin_1_states_provinces.json") ;
  const overviewData = await d3.json("./overview_data.json") ;
  const hcsrnSiteArray = overviewData["sites"] ;
  hcsrnStates = getStates(hcsrnSiteArray) ;

  hcsrnSites = {} ;
  hcsrnSiteArray.map((d) => hcsrnSites[d.abbr] = d) ;

  const stateNameAccessor = (d) => d.properties["gn_name"] ;
  const stateAbbrAccessor = (d) => d.properties.postal ;
  const latLongAccessor = (d) => [d.longitude, d.latitude] ;

  let dimensions = {
    width: window.innerWidth * 0.7,
    height: window.innerHeight * 0.8,
  } ;

  const wrapper = d3.select("#wrapper")
    .append("svg")
    .attr("width", dimensions.width)
    .attr("height", dimensions.height)
  ;

  // default is for map to be drawn in dead center--that's too low, so we skooch it up a bit.
  // laptop screen has 578 for window.innerHeight. big monitor is 978
  skooch_factor = window.innerHeight > 800 ? 0.12 : 0.09 ;
  console.log(window.innerHeight) ;
  const bounds = wrapper.append("g")
    .attr("transform", `translate(-20, -${window.innerHeight * skooch_factor})`)
    .attr("id", "states-and-centers")
  ;

  const projection = d3.geoAlbersUsa()
     .translate([dimensions.width/2, dimensions.height/2])    // translate to center of screen
     .scale([window.innerWidth * 0.6]);          // scale things down so see entire US
  ;

  const path = d3.geoPath(projection) ;

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

  // Voronoi overlay to pop the research-center-specific tooltip info
  const delaunay = d3.Delaunay.from(
    hcsrnSiteArray,
    d => projection(latLongAccessor(d))[0],
    d => projection(latLongAccessor(d))[1],
  ) ;

  const voronoi = delaunay.voronoi() ;
  voronoi.xmax = dimensions.Width ;
  voronoi.ymax = dimensions.Height ;

  const voronoiContainer = wrapper.append("g")
    .attr("transform", `translate(-20, -${window.innerHeight * skooch_factor})`)
    .attr("id", "voronoi-container")
  ;

  voronoiContainer.selectAll(".voronoi")
    .data(hcsrnSiteArray)
    .enter().append("path")
      .attr("class", "voronoi")
      .attr("id", (d) => d.abbr)
      .attr("d", (d,i) => voronoi.renderCell(i))
      .on("mouseenter", onMouseEnter)
      .on("mouseleave", onMouseLeave)

  const tooltip = d3.select("#tooltip") ;
  const it_timeline = d3.select("#timeline") ;

  function onMouseEnter(datum) {
    const this_center = bounds.select(`circle#${datum.abbr}`) ;
    this_center.attr("class", "highlighted-research-center")
      .attr("r", 14);
    tooltip.select("#name").text(datum.long_name) ;
    tooltip.select("#location").text("Location: " + datum.location) ;
    tooltip.select("#sdm").text("Site Data Manager: " + datum.manager) ;
    tooltip.style("left", (d3.event.pageX) + "px")
      .style("top", (d3.event.pageY - 28) + "px");
    drawImplementations(overviewData, datum.abbr, it_timeline) ;
    tooltip.style("opacity", .8) ;
  }

  function onMouseLeave(datum) {
    const this_center = bounds.select(`circle#${datum.abbr}`) ;
    this_center.attr("class", "research-center")
      .attr("r", 8);
    tooltip.style("opacity", 0) ;
  }


  leg_skooch =  window.innerHeight > 800 ? [420, 580] : [220, 390] ;
  const legendGroup = wrapper.append("g")
    // .attr("transform", "translate(420, 530)") // good for big monitor
    // .attr("transform", `translate(220, 390)`) // good for laptop screen
    .attr("transform", `translate(${leg_skooch})`)
    .attr("id", "legend")
  ;
  draw_legend(legendGroup) ;
}

drawMap() ;