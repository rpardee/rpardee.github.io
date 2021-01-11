affiliatedStates = ['ND', 'KS', 'NE', 'AR', 'TN', 'KY', 'OH'] ;
hcsrnStates = []

async function drawImplementations(overviewData, site_abbr, draw_div) {

  // What specs do we want to display?
  const key_specs = {
    "enrl":     {"name": "Enrollments"   , "sort_order": 1},
    "ute-enc":  {"name": "Utilization"   , "sort_order": 2},
    "rx":       {"name": "Rx Fills"      , "sort_order": 3},
    "lab":      {"name": "Lab Results"   , "sort_order": 4},
    "vitals":   {"name": "Vital Signs"   , "sort_order": 5},
    // "soc":      {"name": "Social History", "sort_order": 6},
    "death":    {"name": "Death"         , "sort_order": 7},
    "tumor":    {"name": "Tumor"         , "sort_order": 8}
  }

  const firstYear = 1970 ;
  const thisYear = new Date().getFullYear() ;

  function clean_messy_years(inYear) {
    let clean_year ;
    if (inYear === undefined) {
      return inYear ;
    } else {
      if (inYear == 'Present') {inYear = thisYear} ;
      if (Number.isInteger(inYear)) {
        clean_year = inYear
      } else {
        clean_year = Number(inYear.match('\\d{4}')) ;
      }
      if (clean_year == 0) {clean_year = undefined} ;
      return clean_year ;
    }
  }

  // Filter down the implementation info to the site we're looking at, and just the key specifications.
  let implementations = overviewData["implementations"].filter((d) => d["site"] == site_abbr && d["data area"] in key_specs).map((d) => {
    const sy = clean_messy_years(d.start_year) ;
    const ey = clean_messy_years(d.end_year) ;
    d.end_year = ey ;
    d.start_year = sy ;
    d.apply_class = "implemented"
    return d ;
  }) ;

  // supplement implementations w/any not-implemented key specs
  for(var key_spec in key_specs) {
    console.log(site_abbr, "Checking for ", key_spec) ;
    const this_spec = implementations.filter((imp) => imp["data area"] == key_spec) ;
    if (this_spec.length == 0) {
      console.log(site_abbr, "Not found", key_spec) ;
      implementations.push({"data area": key_spec, "start_year": firstYear, "end_year": thisYear, "apply_class": "not-implemented"}) ;
    }
    else {
      console.log(site_abbr, "found", key_spec) ;
      console.log(this_spec) ;
    }
  }

  console.table(implementations) ;

  const yAccessor = (d) => key_specs[d["data area"]]['name'] ;

  function sortImp(a, b) {
    if (key_specs[a["data area"]]['sort_order'] < key_specs[b["data area"]]['sort_order']) return -1 ;
    if (key_specs[a["data area"]]['sort_order'] > key_specs[b["data area"]]['sort_order']) return  1 ;
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
    // .domain(d3.extent(implementations.map((d) => [d.start_year, d.end_year]).flat()))
    .domain([firstYear, thisYear])
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
      .attr("width", (d) => xScale(d.end_year) - xScale(d.start_year))
      .attr("height", yScale.bandwidth())
      .attr("class", (d) => d.apply_class)
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
  let ret = new Set() ;
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

  const legEntries = {
    hcsrn: {"text": "State in which HCSRN Research Centers Are Based"},
    affiliated: {"text": "Research Communities Affilated with HCRSN members"}
  }

  let y = 3 ;
  const sqSide = 20 ;

  for(var entry in legEntries) {
    const thisEntry = legEntries[entry] ;
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
  d3.select('#shitty-browsers-f-off').remove() ;
  const stateShapes = await d3.json("./ne_110m_admin_1_states_provinces.json") ;
  const overviewData = await d3.json("./overview_data.json") ;
  const hcsrnSiteArray = overviewData["sites"] ;
  hcsrnStates = getStates(hcsrnSiteArray) ;

  const stateNameAccessor = (d) => d.properties["gn_name"] ;
  const stateAbbrAccessor = (d) => d.properties.postal ;
  const latLongAccessor = (d) => [d.longitude, d.latitude] ;

  let dimensions = {
    width:  window.innerWidth  * 0.9,
    height: window.innerHeight * 0.85,
    margins: {
      top: 5,
      bottom: 30,
      left: 5,
      right: 5
    }
  } ;

  dimensions.boundedWidth = dimensions.width - dimensions.margins.left - dimensions.margins.right ;
  dimensions.boundedHeight = dimensions.height - dimensions.margins.top - dimensions.margins.bottom ;

  const wrapper = d3.select("#wrapper")
    .append("svg")
    .attr("width", dimensions.width)
    .attr("height", dimensions.height)
  ;

  // default is for map to be drawn in dead center--that's too low, so we skooch it up a bit.
  // laptop screen has 578 for window.innerHeight. big monitor is 978
  const bounds = wrapper.append("g")
    .style("transform", `translate(${dimensions.margins.left}px, ${dimensions.margins.top}px)`)
    .attr("id", "bounds")
  ;

  const projection = d3.geoAlbersUsa()
     .translate([dimensions.width/3, dimensions.height/2.5])    // translate to center of screen
     .scale([window.innerWidth * 0.7]);          // scale things down so see entire US
  ;

  const path = d3.geoPath(projection) ;

  // draw the state shapes (svg paths)
  const stateHolder = bounds.append('g')
    .attr("id", "state-shapes")
  ;
  const states = stateHolder.selectAll('path')
    .data(stateShapes.features)
    .enter().append("path")
    .attr("class", (d) => getStateClass(stateAbbrAccessor(d)))
    .attr("id", stateAbbrAccessor)
    // .attr("d", path(stateShapes)) WRONG!
    .attr("d", path) // equiv to: (d) => path(d)
  ;

  // draw the research centers
  const researchCenterHolder = bounds.append("g")
    .attr("id", "research-centers")
  ;
  const researchCenters = researchCenterHolder.selectAll("circle")
    .data(hcsrnSiteArray)
    .enter().append("circle")
      .attr("class", "research-center")
      .attr("id", (d) => d.abbr)
      .attr("cx", (d) => projection(latLongAccessor(d))[0])
      .attr("cy", (d) => projection(latLongAccessor(d))[1])
      .attr("r", 8)
      .on("mouseenter", onMouseEnter)
      .on("mouseleave", onMouseLeave)
  ;

  // Voronoi overlay to pop the research-center-specific tooltip info
  const delaunay = d3.Delaunay.from(
    hcsrnSiteArray,
    d => projection(latLongAccessor(d))[0],
    d => projection(latLongAccessor(d))[1],
  ) ;

  const voronoi = delaunay.voronoi() ;
  voronoi.xmax = dimensions.width ;
  voronoi.ymax = dimensions.height ;

  bounds.selectAll(".voronoi")
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
    // .attr("transform", `translate(${leg_skooch})`)
    .style("transform", `translate(${dimensions.boundedWidth / 4}px, ${dimensions.boundedHeight * 0.9}px)`)
    .attr("id", "legend")
  ;
  draw_legend(legendGroup) ;
}

drawMap() ;
