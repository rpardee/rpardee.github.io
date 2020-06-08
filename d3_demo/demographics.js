async function drawTimeline(data_area, draw_div) {
  // access & massage data
  data = await d3.json('./overview_data.json') ;
  cols = data["sites"] ;
  site_lookup = {} ;
  cols.map((d) => site_lookup[d.abbr] = d) ;
  cols.unshift({"name": "Data Area", "abbr": "nil"}) ;

  implementations = data["implementations"].filter((d) => d["data area"] == data_area).map((d) => {
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
    // if (Number.isInteger(d.start_year) 
    //   && Number.isInteger(d.end_year)
    //   && d.start_year > 0
    //   ) {return d} ;
    // if (d.start_year > 0) {return d} ;
    return d ;
  }) 
  ;

  // console.table(implementations) ;

  yAccessor = (d) => site_lookup[d.site].name ;

  function sortImp(a, b) {
    if (a.site < b.site) return -1 ;
    if (a.site > b.site) return  1 ;
    return 0 ;
  }

  implementations = implementations.sort(sortImp) ;

  let dimensions = {
    width: 600,
    height: 400,
    margin: {
      top: 15,
      right: 15,
      bottom: 40,
      left: 60,
    },
  }
  dimensions.boundedWidth = dimensions.width
    - dimensions.margin.left
    - dimensions.margin.right
  dimensions.boundedHeight = dimensions.height
    - dimensions.margin.top
    - dimensions.margin.bottom

  wrapper = d3.select("#wrapper") 
    .append("svg")
    .attr("width", dimensions.width)
    .attr("height", dimensions.height)
  ;

  const bounds = wrapper.append("g")
      .style("transform", `translate(${
        dimensions.margin.left
      }px, ${
        dimensions.margin.top
      }px)`)

  const xScale = d3.scaleLinear()
    .domain(d3.extent(implementations.map((d) => [d.start_year, d.end_year]).flat()))
    .range([0, dimensions.boundedWidth])
    .nice()
  ;

  // console.log(data_area) ;
  // console.log(xScale.domain()) ;
  // console.table(implementations) ;

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
      .attr("fill", "cornflowerblue")
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

drawTimeline("lang") ;
