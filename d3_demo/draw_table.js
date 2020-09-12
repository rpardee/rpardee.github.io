async function drawTimeline(data_area, draw_div) {

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
    // width: window.innerWidth * 0.9,
    // height: window.innerHeight * 0.9,
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

async function draw_overview() {
  
  data = await d3.json('./overview_data.json') ;

  // one column per site, plus we add an extra for the row labels (data area names)  
  cols = data["sites"] ;
  site_lookup = {} ;
  cols.map((d) => site_lookup[d.abbr] = d) ;
  cols.unshift({"name": "Data Area", "abbr": "nil"}) ;

  da_lookup = {} ;
  data["data areas"].map((d) => da_lookup[d.abbr] = d) ;

  // the tooltip when the user hovers over an implementation cell
  imp_tooltip = d3.select("#imp-tooltip") ;

  // Set the various bits of the tooltip as appropriate.
  function showImpTooltip(datum) {
    sitespan = imp_tooltip.select("#site") 
      .text(site_lookup[datum.site].name || 'zah?')
    ;
    sitespan = imp_tooltip.select("#area") 
      .text(da_lookup[datum["data area"]].name)
    ;
    sitespan = imp_tooltip.select("#freq") 
      .text(datum["update frequency"])
    ;
    sitespan = imp_tooltip.select("#lag") 
      .text(datum.lag)
    ;
    sitespan = imp_tooltip.select("#notes") 
      .text(datum.notes)
    ;

    // Move the tooltip over to where the mouse pointer is
    const xpos = d3.event.pageX ;
    const ypos = d3.event.pageY ;
    imp_tooltip
      .style("transform", `translate(${xpos}px, ${ypos}px)`)
      .style("opacity", 0.85) 
    ;

    // console.log(table._groups[0][0].clientHeight) ;

  } 

  function fadeImpTooltip(datum) {
    imp_tooltip.style("opacity", 0) ;
  }

  // the tooltip when the user hovers over a site name (col header)
  site_tooltip = d3.select("#site-tooltip") ;
  function showSiteTooltip(datum) {
    if (datum.abbr != 'nil') {
      sitespan = site_tooltip.select("#location") 
        .text(datum.location || 'zah?')
      ;
      sitespan = site_tooltip.select("#manager") 
        .text(datum.manager || 'zah?')
      ;
      // Move the tooltip over to where the mouse pointer is
      const xpos = d3.event.pageX ;
      const ypos = d3.event.pageY ;
      site_tooltip
        .style("transform", `translate(${xpos}px, ${ypos}px)`) 
        .style("opacity", 0.85)
      ;
    } 
  } 

  function fadeSiteTooltip(datum) {
    site_tooltip.style("opacity", 0) ;
    // console.log('yo') ;
  }

  // The tooltip when the user hovers over a dataset name (row header)
  dset_tooltip = d3.select("#dset-tooltip") ;
  it_timeline = d3.select("#timeline") ;
  function showDsetTooltip(datum) {
    if (datum.abbr != 'nil') {
      sitespan = dset_tooltip.select("#stdvar") 
        .text(datum.stdvar || 'zah?')
      ;
      sitespan = dset_tooltip.select("#last-qa") 
        .text(datum.last_qa || 'Unknown')
      ;
      drawTimeline(datum.abbr, it_timeline) ;
      // Move the tooltip over to where the mouse pointer is
      const xpos = d3.event.pageX ;
      const ypos = d3.event.pageY * 0.4 ;
      dset_tooltip
        .style("transform", `translate(${xpos}px, ${ypos}px)`) 
        // .style("transform", `translate(${xpos}px, 10px)`) 
        .style("opacity", 0.85)
      ;
    } 
  } 

  function fadeDsetTooltip(datum) {
    dset_tooltip.style("opacity", 0) ;
    // console.log('yo') ;
  }

  table = d3.select("#overview") ;
  // write out the column headers
  table.append("thead").append("tr")
    .selectAll("thead")
    .data(cols)
    .enter().append("th")
      .text(d => d.name)
      .on("mouseenter", showSiteTooltip)
      .on("mouseleave", fadeSiteTooltip)
  ;

  body = table.append("tbody") ;
  // Add a row per data area, with one cell per column
  // each cell gets an id of ::site abbrev::-::data area abbrev:: so we can find it later to set its contents & class
  data["data areas"].forEach(d => {
    body.append("tr")
      .selectAll("td")
      .data(cols)
      .enter().append("td")
        .attr("id", (site) => site.abbr.concat('-', d.abbr))
        .append("span")
          .attr("class", "update-frequency")
          .text("Not Implemented")
  }) ;

  function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

  const freq_abbrevs = {"Daily": "D"
      , "Semi-Annually": "SA"
      , "Monthly":"M"
      , "Monthly+":"M+"
      , "Quarterly": "Q"
      , "Quarterly+": "Q+"
      , "Annually": "A"
      , "Annually+": "A+"
      , "Weekly": "W"
      , "Tri-Annually": "T"
      , "On request": "O"
    } ;

  // Fill in the substantive implementation info in the appropriate cells
  data.implementations.forEach(imp => {
    id = imp.site.concat('-', imp["data area"])
    d3.select(`#${id}`)
      .data([imp]) //WTF? https://stackoverflow.com/questions/10086167/d3-how-to-deal-with-json-data-structures
      .text(`${imp.start_year} - ${imp.end_year}`)
      .on("mouseenter", showImpTooltip)
      .on("mouseleave", fadeImpTooltip)
      .append("span")
        .attr("class", "update-frequency")
        .text(freq_abbrevs[imp["update frequency"]])
  }) ;

  // Fill in the row header text (leftmost column)
  data["data areas"].forEach(d => {
    id = 'nil'.concat('-', d.abbr)
    d3.select(`#${id}`)
      .data([d])
      .html("<a href='" + d.name + ".html'>" + d.name + "</a>")
      .attr("class", "row-header")
      .on("mouseenter", showDsetTooltip)
      .on("mouseleave", fadeDsetTooltip)
      .append("span")
        .text(d.descr)
  }) ;

}

draw_overview() ;
