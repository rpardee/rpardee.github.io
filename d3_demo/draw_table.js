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
    imp_tooltip.style("opacity", 0.85) ;
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
    imp_tooltip.style("transform", `translate(${xpos}px, ${ypos}px)`) ;

    // console.log(table._groups[0][0].clientHeight) ;

  } 

  function fadeImpTooltip(datum) {
    imp_tooltip.style("opacity", 0) ;
    // console.log('yo') ;
  }

  // the tooltip when the user hovers over a site name (col header)
  site_tooltip = d3.select("#site-tooltip") ;
  function showSiteTooltip(datum) {
    if (datum.abbr != 'nil') {
      site_tooltip.style("opacity", 0.85) ;
      sitespan = site_tooltip.select("#location") 
        .text(datum.location || 'zah?')
      ;
      sitespan = site_tooltip.select("#manager") 
        .text(datum.manager || 'zah?')
      ;
    } 

    // Move the tooltip over to where the mouse pointer is
    const xpos = d3.event.pageX ;
    const ypos = d3.event.pageY ;
    site_tooltip.style("transform", `translate(${xpos}px, ${ypos}px)`) ;

    // console.log(table._groups[0][0].clientHeight) ;

  } 

  function fadeSiteTooltip(datum) {
    site_tooltip.style("opacity", 0) ;
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
        .text("?")
        .attr("id", (site) => site.abbr.concat('-', d.abbr))
  }) ;

  function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

  fake_implementations = [] ;
  data.sites.forEach((site) => {
    data["data areas"].forEach((dset) => {
      sy = 1970 + getRandomInt(30) ;
      ey = 2020 - getRandomInt(8) ;
      uf = getRandomInt(4) ;
      switch(uf) {
        case 0:
          uf = "Daily" ;
          break ;
        case 1:
          uf = "semi-annually" ;
          break ;
        case 2:
          uf = "Monthly" ;
          break ;
        case 3:
          uf = "Weekly" ;
          break ;
      }

      if (ey == 2020) {ey = "present"} ;
      if (site.abbr != 'nil') {
        fake_implementations.push({"site": site.abbr, "data area": dset.abbr, "start_year": sy, "end_year": ey, "update frequency": uf, "lag": "unknown", "notes": "This is made-up information"}) ;
      }
    }) ;
  }) ;

  // Fill in the substantive implementation info in the appropriate cells
  // data.implementations.forEach(imp => {
  fake_implementations.forEach(imp => {
    id = imp.site.concat('-', imp["data area"])
    d3.select(`#${id}`)
      .data([imp]) //WTF? https://stackoverflow.com/questions/10086167/d3-how-to-deal-with-json-data-structures
      .text(`${imp.start_year} - ${imp.end_year}`)
      .attr("class", imp["update frequency"])
      .on("mouseenter", showImpTooltip)
      .on("mouseleave", fadeImpTooltip)
  }) ;

  // Fill in the row header text (leftmost column)
  data["data areas"].forEach(d => {
    id = 'nil'.concat('-', d.abbr)
    d3.select(`#${id}`)
      .text(d.name)
      .attr("class", "row-header")
      .append("span")
        .text(d.descr)
  }) ;

}

draw_overview() ;
