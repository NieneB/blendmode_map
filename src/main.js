// Check for Mapbox gl SUPPORT:
if (!mapboxgl.supported()) {
    alert('Your browser does not support Mapbox GL');
};

// MAP OPTIONS
var options = {
  container: "map",
  hash: true,
  style: "./art.json",
  zoom: 14.5,
  pitch: 0,
  bearing: -15.7,
  center: [5.24574, 51.81254],
  attributionControl:false
};




// INITIALIZE MAP
var map = new mapboxgl.Map(options);
map.addControl(new mapboxgl.AttributionControl({ compact: true }));

// LOADER
map.on("idle", function () {
  document.getElementById("loader").src = "./img/webmapper_logo.svg"
})
map.on("movestart", function(){
  document.getElementById("loader").src = "./img/webmapper_logo-animated.svg"
})
// map.showTileBoundaries = true;
// map.showCollisionBoxes = true;
// map.repaint = false;

// var filterGroup = document.getElementById('filter-group');
// RADOM HOT AIR BALLOONS
// var places = ["Luchtfoto", "Sattaliet 2018", "water", "tenten"]
// map.on("load",function(e){
//   // Add checkbox and label elements for the layer.
//     places.forEach(function (feature) {
//     var input = document.createElement('input');
//     input.type = 'checkbox';
//     input.id = feature;
//     input.checked = true;
//     filterGroup.appendChild(input);

//     var label = document.createElement('label');
//     label.setAttribute('for', feature);
//     label.textContent = feature;
//     filterGroup.appendChild(label);

//     // When the checkbox changes, update the visibility of the layer.
//     input.addEventListener('change', function (e) {
//       map.setLayoutProperty(feature, 'visibility',
//         e.target.checked ? 'visible' : 'none');
//     });
// })
// });


// GEOCODER
// ============================================

// RECENTER MAP ON CHOSEN LOCATION
function recenterMap(target) {
  map.jumpTo({ center: target.coordinates, zoom: 14 });
};

const geocoder = {};
const CONFIG = {};
CONFIG.CLASSNAMES = {
  'geocoderContainer': ['nlmaps-geocoder-control-container'],
  'geocoderSearch': ['nlmaps-geocoder-control-search'],
  'geocoderButton': ['nlmaps-geocoder-control-button'],
  'geocoderResultList': ['nlmaps-geocoder-result-list'],
  'geocoderResultItem': ['nlmaps-geocoder-result-item'],
  'geocoderResultSelected' : ['nlmaps-geocoder-result-selected']
}

geocoder.lookupUrl = "https://geodata.nationaalgeoregister.nl/locatieserver/lookup?fl=*&";
geocoder.suggestUrl = "https://geodata.nationaalgeoregister.nl/locatieserver/suggest?rows=10&fq=type:woonplaats&";
geocoder.placeholder = "Mijn woonplaats";

function httpGetAsync(url) {
  // eslint-disable-next-line no-unused-vars
  return new Promise((resolve, reject) => {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
      // eslint-disable-next-line eqeqeq
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
        resolve(JSON.parse(xmlHttp.responseText));
      }
    }
    xmlHttp.open("GET", url, true); // true for asynchronous
    xmlHttp.send(null);
  });
}

function wktPointToGeoJson(wktPoint) {
  if (!wktPoint.includes('POINT')) {
    throw TypeError('Provided WKT geometry is not a point.');
  }
  const coordinateTuple = wktPoint.split('(')[1].split(')')[0];
  const x = parseFloat(coordinateTuple.split(' ')[0]);
  const y = parseFloat(coordinateTuple.split(' ')[1]);

  return {
    type: 'Point',
    coordinates: [x, y]
  }

}

geocoder.resultList = [];
geocoder.selectedResult = -1;
/**
 * Make a call to PDOK locatieserver v3 suggest service. This service is meant for geocoder autocomplete functionality. For
 * additional documentation, check https://github.com/PDOK/locatieserver/wiki/API-Locatieserver.
 * @param {string} searchTerm The term which to search for
 */
geocoder.doSuggestRequest = function (searchTerm) {
  return httpGetAsync(`${this.suggestUrl}q=${encodeURIComponent(searchTerm)}`);
}

/**
 * Make a call to PDOK locatieserver v3 lookup service. This service provides information about objects found through the suggest service. For additional
 * documentation, check: https://github.com/PDOK/locatieserver/wiki/API-Locatieserver
 * @param {string} id The id of the feature that is to be looked up.
 */
geocoder.doLookupRequest = function (id) {
  return httpGetAsync(`${this.lookupUrl}id=${encodeURIComponent(id)}`).then((lookupResult) => {
    // A lookup request should always return 1 result
    const geocodeResult = lookupResult.response.docs[0];
    geocodeResult.centroide_ll = wktPointToGeoJson(geocodeResult.centroide_ll);
    geocodeResult.centroide_rd = wktPointToGeoJson(geocodeResult.centroide_rd);
    return geocodeResult;
  });
}

geocoder.createControl = function (zoomFunction, map) {
  this.zoomTo = zoomFunction;
  this.map = map;
  const container = document.createElement('div');
  const searchDiv = document.createElement('form');
  const input = document.createElement('input');
  const button = document.createElement('button');
  const results = document.createElement('div');

  parseClasses(container, CONFIG.CLASSNAMES.geocoderContainer);
  parseClasses(searchDiv, CONFIG.CLASSNAMES.geocoderSearch);
  container.addEventListener('click', e => e.stopPropagation());
  container.addEventListener('dblclick', e => e.stopPropagation());

  input.id = 'nlmaps-geocoder-control-input';
  input.placeholder = geocoder.placeholder;

  input.setAttribute('aria-label', geocoder.placeholder);
  input.setAttribute('type', 'text');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');

  input.addEventListener('keydown', (e) => {
    let results = this.resultList;
    if (this.resultList.length > 0) {
      if (e.code === 'ArrowDown' || e.keyCode === 40) {
        if (this.selectedResult < this.resultList.length - 1) {
          this.selectedResult++;
        }
        this.showLookupResult(results[this.selectedResult]);

      }
      if (e.code === 'ArrowUp' || e.keyCode === 38) {
        if (this.selectedResult > 0) {
          this.selectedResult--;
        }
        this.showLookupResult(results[this.selectedResult]);
      }
      if (e.code === 'Escape') {

        this.clearSuggestResults(true);
      }
    }
  })
  input.addEventListener('input', (e) => {

    this.suggest(e.target.value);
  });
  input.addEventListener('focus', (e) => {
    this.suggest(e.target.value);
  });
  button.setAttribute('type', 'submit');
  searchDiv.addEventListener('submit', (e) => {
    e.preventDefault();
    if (this.resultList.length > 0) {
      this.lookup(this.resultList[this.selectedResult < 0 ? 0 : this.selectedResult].id);
    }
  })
  button.setAttribute('aria-label', geocoder.placeholder);
  parseClasses(button, CONFIG.CLASSNAMES.geocoderButton);

  results.id = 'nlmaps-geocoder-control-results';
  parseClasses(results, CONFIG.CLASSNAMES.geocoderResultList);
  results.classList.add('nlmaps-hidden');
  container.appendChild(searchDiv);
  searchDiv.appendChild(input);
  searchDiv.appendChild(button);
  container.appendChild(results);

  return container;
}

geocoder.suggest = function (query) {
  if (query.length < 3) {
    this.clearSuggestResults();
    return;
  }

  this.doSuggestRequest(query).then((results) => {
    this.resultList = results.response.docs;
    this.showSuggestResults(this.resultList);
  });
}

geocoder.lookup = function (id) {
  this.doLookupRequest(id).then((result) => {
    console.log(result.centroide_ll);
    this.zoomTo(result.centroide_ll);
    // this.nlmaps.emit('search-select', { location: result.weergavenaam, latlng: result.centroide_ll, resultObject: result });
    this.showLookupResult(result);
    this.clearSuggestResults();
  });
}

geocoder.clearSuggestResults = function (input) {
  this.selectedResult = -1;
  if (input) document.getElementById('nlmaps-geocoder-control-input').value = '';
  document.getElementById('nlmaps-geocoder-control-results').innerHTML = '';
  document.getElementById('nlmaps-geocoder-control-results').classList.add('nlmaps-hidden');

}
geocoder.showLookupResult = function (result) {
  let resultNodes = document.getElementsByClassName(CONFIG.CLASSNAMES.geocoderResultItem)
  Array.prototype.map.call(resultNodes, i => i.classList.remove(CONFIG.CLASSNAMES.geocoderResultSelected));
  let resultNode = document.getElementById(result.id);
  if (resultNode) resultNode.classList.add(CONFIG.CLASSNAMES.geocoderResultSelected);
  document.getElementById('nlmaps-geocoder-control-input').value = result.weergavenaam;
}

function parseClasses(el, classes) {
  classes.forEach(classname => {
    el.classList.add(classname);
  });
}

geocoder.showSuggestResults = function (results) {
  this.clearSuggestResults();
  if (results.length > 0) {
    const resultList = document.createElement('ul');
    results.forEach((result) => {

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.innerHTML = result.weergavenaam;
      a.id = result.id;
      parseClasses(a, CONFIG.CLASSNAMES.geocoderResultItem);
      a.setAttribute('href', '#');
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.lookup(e.target.id);
      });
      li.appendChild(a);
      resultList.appendChild(li);
    });
    document.getElementById('nlmaps-geocoder-control-results').classList.remove('nlmaps-hidden');
    document.getElementById('nlmaps-geocoder-control-results').appendChild(resultList);
  }
}

// Add to doc
document.body.appendChild(geocoder.createControl(recenterMap, map));