async function drawTimeline() {
  // access & massage data
  data = await d3.json('./overview_data.json') ;
  demog_imps = data["implementations"].filter((d) => d["data area"] == "demog").map((d) => {
    if (d.end_year == 'Present') {d.end_year = new Date().getFullYear()} ;
    if (d.end_year == '4/2013') {d.end_year = 2013} ;
    if (d.end_year == '6/2019') {d.end_year = 2019} ;
    if (d.end_year == '4/2012') {d.end_year = 2012} ;
    // if (d.start_year == 1915) {d.start_year = 1990} ;
    return d ;
  }) 
  ;

  function sortImp(a, b) {
    if (a.site < b.site) return -1 ;
    if (a.site > b.site) return  1 ;
    return 0 ;
  }

  demog_imps = demog_imps.sort(sortImp) ;

  let dimensions = {
    width: window.innerWidth * 0.9,
    height: 600,
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
    .domain(d3.extent(demog_imps.map((d) => [d.start_year, d.end_year]).flat()))
    .range([0, dimensions.boundedWidth])
    .nice()
  ;

  const yScale = d3.scaleBand()
    .domain(demog_imps.map((d) => d.site))
    // .rangeRound([dimensions.margin.top, dimensions.height - dimensions.margin.bottom])
    .rangeRound([0, dimensions.boundedHeight])
    .padding(0.1)  ;

  const rects = bounds.selectAll("rect")
    .data(demog_imps)
    .enter().append("rect")
      .attr("x", (d) => xScale(d.start_year))
      .attr("y", (d) => yScale(d.site))
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
    // .tickValues(demog_imps.map((d) => d.site))
  ;

  const yAxis = bounds.append("g")
    .call(yAxisGenerator)
    // .style("transform", `translateX(${dimensions.boundedWidth}px)`)
  ;

  // console.table(demog_imps) ;
}

drawTimeline() ;