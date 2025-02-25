const spec_cols = [
  {label: "Column Name"               , id: d => `${d.name}-cn`, format: d => d.name                                 , tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d)},
  {label: "Definition"                , id: d => `${d.name}-df`, format: d => d.definition                           , tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d)},
  {label: "Type (length)"             , id: d => `${d.name}-tl`, format: d => format_typelens(d.type, d.length)      , tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d)},
  {label: "Valid Values"              , id: d => `${d.name}-vv`, format: d => format_vallists_vf(d)                  , tfunc: (d) => tdTitle(d, true) , cfunc: (d) => tdClass(d, true), onclick: vv_click},
  {label: "Implementation Guidelines" , id: d => `${d.name}-ig`, format: d => format_igs(d.implementation_guidelines), tfunc: (d) => tdTitle(d) , cfunc: (d) => tdClass(d, false, "hideable")}
  ]

async function drawTimeline(imps, draw_div) {

  implementations = imps.map((d) => {
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

  // console.table(implementations) ;

  data = await d3.json('./overview_data.json') ;

  // one column per site, plus we add an extra for the row labels (data area names)
  cols = data["sites"] ;
  site_lookup = {} ;
  cols.map((d) => site_lookup[d.abbr] = d) ;

  yAccessor = (d) => site_lookup[d.site].name ;
  // yAccessor = (d) => d.site ;

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

}

function tdClass(d, isValidValues = false, defaultClass = "norm") {
  // console.log(d) ;
  if (isValidValues && Array.isArray(d.valid_values)) {
    return "clickable" ;
  }
  return defaultClass ;
}

function tdTitle(d, isValidValues = false) {
  if (isValidValues && Array.isArray(d.valid_values)) {
    return "Click to copy a SAS format statement to your clipboard" ;
  }
  return "" ;
}

function vv_click(datum) {
  // console.log(datum) ;
  if (Array.isArray(datum.valid_values)) {
    const clipText = createFormat(datum) ;
    navigator.clipboard.writeText(clipText).then(function() {
      const notification = d3.select("#notification") 
        .text(`SAS format statement ${datum.name} copied to clipboard`)
        .attr("class", "show")
      ;
      setTimeout(function(){notification.attr("class", "")}, 3000);
      }, function() {
        console.log("boo!") ;
      })    
  }
}

function headerClick(event) {
  // alert('boobies') ;
  if (d3.selectAll(".hidden").empty()) {
    //nothing is hidden--do the hiding
    d3.selectAll(".hideable")
      .attr('class', 'hidden') ;
  } else {
    d3.selectAll(".hidden")
      .attr('class', 'hideable') ;
    }
}
function format_igs(inarr) {
  if (Array.isArray(inarr)) {
    retval = "" ;
    inarr.forEach(ig => {
      retval += "<p>" + ig + "</p>"
    })
  } else {retval = inarr}
  return retval ;
}
function format_typelens(intyp, inlen) {
  if (intyp) {
    typ = intyp ;
    if (inlen) {len = inlen} else {len = '*'} ;
    return typ + "(" + len + ")" ;
  } else {
    return '' ;
  } ;
}
function createFormat(colspec) {
  let retval = ''   ;
  if (Array.isArray(colspec.valid_values)) {
    retval = `value ${makeFormatName(colspec)}` ;
    colspec.valid_values.forEach(d => {
      retval += "\n  '" + d.value + "' = '" + d.meaning + "'"
    })
    retval += "\n;\n" ;
  }
  return retval ;
}

function format_vallists_vf(colspec) {
  if (Array.isArray(colspec.valid_values)) {
    retval = "<dl class = 'dl'>" ;
    colspec.valid_values.forEach(d => {
      retval += "<dt>" + d.value + "</dt>"
      retval += "<dd>" + d.meaning + "</dd>"
    })
    retval += "</dl>" ;
  } else {retval = colspec.valid_values}
  return retval ;
}
function makeFormatName(d) {
  // console.log(d) ;
  retval = d.type == "char" ? "$" : "" ;
  retval += d.name.split('-')[0].replace(/[0-9]/g, '').toLowerCase() ;
  return retval.substr(0, 31) ;
}

async function draw_spec(spec_name, spec_abbr, with_igs = true) {
  all_specs = await d3.json('./specs.json') ;
  od = await d3.json('./overview_data.json') ;
  imps = od['implementations'].filter((da) => da['data area'] == spec_abbr) ;
  spec = all_specs[spec_name] ;
  our_cols = spec_cols ;
  if (!with_igs) {our_cols.pop()} ;

  wrapper = d3.select("#wrapper") ;
  wrapper.attr("class", "vdw-spec") ;
  wrapper.append("div").attr("id", "admonition")
    .append("p").text("Provided as a convenience--this is NOT an official spec.")
  ;
  wrapper.append("div").attr("id", "notification") ;
  wrapper.append("h1").text(spec.name) ;
  wrapper.append("p").html(spec.description) ;
  wrapper.append("h2").text("Standard Variable: " + spec.stdvar) ;
  wrapper.append("h2").text("Columns") ;
  wrapper.append("table")
    .attr("id", "col-tab")
    .append("thead")
      .attr("title", "(Click to toggle display of the Implementation Guidelines)")
    .append("tr")
    .selectAll("thead")
    .data(spec_cols)
    .enter().append("th")
      .text(d => d.label)
      .on("click", headerClick)
      .attr("class", d => d.cfunc(d))
  ;
  const coltab = d3.select("#col-tab") ;
  const tbody = coltab.append("tbody") ;
  spec.columns.forEach(d => {
    tbody.append("tr")
      .selectAll("td")
      .data(spec_cols)
      .enter().append("td")
        .attr("class", column => column.cfunc(d))
        .attr("title", column => column.tfunc(d))
        .attr("id", column => column.id(d))
        .html(column => column.format(d))
        .on("click", column => column.onclick === undefined ? null : column.onclick(d))
    ;
  }) ;

  wrapper.append("h2").text("Primary Key: " + spec.primary_key) ;
  wrapper.append("h2").text("Comments") ;
  spec.comments.forEach((cmt, ind) => {
    wrapper.append("h3").text((ind + 1) + ": " + cmt.title) ;
    wrapper.append("p").html(cmt.comment) ;
  }) ;

  it_timeline = d3.select("#timeline") ;

  drawTimeline(imps, it_timeline) ;

}

