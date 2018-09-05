const express = require('express')
const app = express()
const axios = require('axios')
// const jsonld = require('jsonld');
const octokit = require('@octokit/rest')();
var pg = require('pg');
var fs = require("fs");
var parseString = require('xml2js').parseString;
var util = require('util');

var Museovirasto = {
    MML_codes : {
        kuntakoodi: {},
        maakuntakoodi: {},
        laanikoodi: {},
        paikkatyyppiryhmakoodi: {},
        paikkatyyppialaryhmakoodi: {},
        paikkatyyppikoodi: {},
        seutukuntakoodi: {},
        suuraluekoodi: {},
    }
}

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  
app.get('/mml', (req, res) => {

    console.log(req.originalUrl);

    var text = req.query.text;

    var conn_params = {
        user: "museovirasto",
        host: "localhost",
        database: "mml_paikannimet",
        password: process.env.MUSEOVIRASTO_TOOL_PASS,
        port: 5434
    }
    
    var client = new pg.Client(conn_params);
    client.connect();
    //console.log(client);

    client.query('SELECT * FROM (SELECT DISTINCT ON (paikkaid) kirjoitusasu, kielikoodi, kuntakoodi, maakuntakoodi, laanikoodi, paikkatyyppiryhmakoodi, paikkatyyppialaryhmakoodi, paikkatyyppikoodi, seutukuntakoodi, suuraluekoodi, paikkaid, ST_AsGeoJSON(ST_Transform(wkb_geometry, 4326)) AS geom FROM paikannimi WHERE LOWER(kirjoitusasu) LIKE $1) place ORDER BY kirjoitusasu ASC', [text.toLowerCase() + '%'], (error, result) => {
    //client.query('SELECT * FROM paikannimi WHERE LOWER(kirjoitusasu) LIKE $1', [text.toLowerCase() + '%'], (error, result) => {


        if (error != null) {
            console.log(error);
            res.send(null);
        }
        else {
            //console.log(result);
            var rows = [];
            for (var i = 0; i < result.rows.length; i++) {
                var row = result.rows[i];
                //console.dir(row);
                var data = {
                    kirjoitusasu: row.kirjoitusasu,
                    kielikoodi: row.kielikoodi,
                    kunta: Museovirasto.MML_codes.kuntakoodi[row.kuntakoodi],
                    maakunta: Museovirasto.MML_codes.maakuntakoodi[row.maakuntakoodi],
                    laani: Museovirasto.MML_codes.laanikoodi[row.laanikoodi],
                    paikkatyyppiryhma: Museovirasto.MML_codes.paikkatyyppiryhmakoodi[row.paikkatyyppiryhmakoodi],
                    paikkatyyppialaryhma: Museovirasto.MML_codes.paikkatyyppialaryhmakoodi[row.paikkatyyppialaryhmakoodi],
                    paikkatyyppi: Museovirasto.MML_codes.paikkatyyppikoodi[row.paikkatyyppikoodi],
                    seutukunta: Museovirasto.MML_codes.seutukuntakoodi[row.seutukuntakoodi],
                    suuralue: Museovirasto.MML_codes.suuraluekoodi[row.suuraluekoodi],
                    paikkaid: row.paikkaid,
                    geom: JSON.parse(row.geom)
                }
                rows.push(data);
            }
            //console.log(rows);
            res.send(rows);
            //res.send(result.rows);
        }
        client.end();
    });


});

app.get('/paikkatiedot', (req, res) => {

    console.log(req.originalUrl);

    //console.log(req.query.paikkatiedotURI + ".jsonld");

    // jsonld.expand(req.query.paikkatiedotURI + ".jsonld").then(expanded => {
    //     console.log(expanded);
    //     res.send({});    
    // });

    var requestConfig = {
        url: req.query.paikkatiedotURI + ".jsonld",
        method: "get",
    };

    axios.request(requestConfig).
        then(function (response) {
            //console.log(response.data);

            var start = response.data.indexOf('{');
            var end = response.data.lastIndexOf('}') + 1;

            var data = response.data.substring(start, end);

            res.send(data);

    }).catch(error => {
        console.log(error);
        res.send(null);
    });
});

app.get('/nimiarkisto', (req, res) => {

    console.log(req.originalUrl);
    
    getNimiarkistoData(req.query.text).then(searhResults => {
        getNimiarkistoDataDetails(searhResults).then(dataDetails => {
            getLabels(dataDetails).then(labels => {
                var data = {
                    //searhResults: searhResults,
                    dataDetails: dataDetails,
                    labels: labels
                }
                res.send(data);
            });
        });
    });
})


app.get('/Finto-ehdotus/YSE/issues', (req, res) => {
    octokit.issues.getForRepo({
        owner: 'Finto-ehdotus',
        repo: 'YSE'
      }).then(({data, headers, status}) => {
        console.log(data);
        res.send(data);
      })
})

const getLabels = async function(dataDetails) {
    var allIDs = [];

    dataDetails.forEach(dataDetail => {

        var claims = Object.keys(dataDetail.claims).map(function(e) {
            return dataDetail.claims[e];
        });
        claims.forEach(claim => {
            //console.log(claim[0].mainsnak);
            if (claim[0].mainsnak != undefined && claim[0].mainsnak.property == "P31") {
                //console.log(claim[0].mainsnak);
                if (allIDs.indexOf(claim[0].mainsnak.datavalue.value.id) == -1) {
                    allIDs.push(claim[0].mainsnak.datavalue.value.id);
                }
            }
        });
    });

    var index = 0;
    var parts = [];
    //console.log(part.length);
    while (index < allIDs.length) {
        //console.log(index);
        var part = allIDs.slice(index, index + 50);
        //console.log(part.length);
        //console.log(part);
        parts.push(part);
        index += 50;
    }

    //console.log(parts);

    var allEntities = [];

    for (var i = 0; i < parts.length; i++) {
        //console.log(ids);
        ids = parts[i].join('|');
        //console.dir(ids);

        var requestConfig = {
            baseURL: "https://nimiarkisto.fi/",
            url: "/w/api.php",
            method: "get",
            params: {
                action: "wbgetentities",
                ids: ids,
                props: "labels",
                languages: "fi",
                format: "json"
            }
        }

        var wikidataEntitiesResponse = await axios.request(requestConfig);

        //console.log(wikidataEntitiesResponse.data);
        var entities = Object.keys(wikidataEntitiesResponse.data.entities).map(function(e) {
            return wikidataEntitiesResponse.data.entities[e];
        });
        //console.log(entities);
        allEntities = allEntities.concat(entities);
    }
    //console.log("collectWikidataInfo, allEntities", allEntities);

    return allEntities;
}

const getNimiarkistoDataDetails = async function(searhResults) {

    var allIDs = [];

    searhResults.forEach(searhResult => {
        allIDs.push(searhResult.id);
    });

    var index = 0;
    var parts = [];
    //console.log(part.length);
    while (index < allIDs.length) {
        //console.log(index);
        var part = allIDs.slice(index, index + 50);
        //console.log(part.length);
        //console.log(part);
        parts.push(part);
        index += 50;
    }

    //console.log(parts);

    var allEntities = [];

    for (var i = 0; i < parts.length; i++) {
        //console.log(ids);
        ids = parts[i].join('|');
        //console.dir(ids);

        var requestConfig = {
            baseURL: "https://nimiarkisto.fi/",
            url: "/w/api.php",
            method: "get",
            params: {
                action: "wbgetentities",
                ids: ids,
                languages: "fi",
                format: "json"
            }
        }

        var wikidataEntitiesResponse = await axios.request(requestConfig);

        //console.log(wikidataEntitiesResponse.data);
        var entities = Object.keys(wikidataEntitiesResponse.data.entities).map(function(e) {
            return wikidataEntitiesResponse.data.entities[e];
        });
        //console.log(entities);
        allEntities = allEntities.concat(entities);
    }
    //console.log("collectWikidataInfo, allEntities", allEntities);

    return allEntities;
}

const getNimiarkistoData = async function(text) {
    
    const limit = 50;
    var cont = 0;
    var allResults = []; 
    var moreData = true;

    while (moreData) {

        var requestConfig = {
            baseURL: "https://nimiarkisto.fi/",
            url: "/w/api.php",
            method: "get",
            params: {
                action: "wbsearchentities",
                search: text,
                language: "fi",
                limit: limit,
                continue: cont,
                format: "json"
            }
        };

        var data = await axios.request(requestConfig).
            then(function (response) {
                //console.log(response.data);
                return response.data;
            }).catch(error => {
                return null;
            });

        if (data != null) {
            allResults = allResults.concat(data.search);
        }

        if (data.search.length > 0 && data.search.length == limit) {
            cont += limit;
        }
        else {
            moreData = false;
        }
    }

    //console.log(allResults.length);

    return allResults;
}

var setupMuseovirastoAPI = function() {

    Object.keys(Museovirasto.MML_codes).forEach((key) => {

        (function(codeName){
            fs.readFile("mml_xsd/" + codeName + ".xsd", "utf8", function(error, data) {
                parseString(data, (err, result) => {
                    //console.dir(result);
                    xsd_enumerations = result['xsd:schema']['xsd:simpleType'][0]['xsd:restriction'][0]['xsd:enumeration'];
                    //console.dir(xsd_enumerations);
                    for (var i = 0; i < xsd_enumerations.length; i++) {
                        var code = parseInt(xsd_enumerations[i]['$']['value']);
                        //console.log(code);
                        //console.log(xsd_enumerations[i]['xsd:annotation'][0]['xsd:documentation'][0]['_']);
                        var value = xsd_enumerations[i]['xsd:annotation'][0]['xsd:documentation'][0]['_'];
                        Museovirasto.MML_codes[codeName][code] = value;
                    }
                    //console.dir( Museovirasto.MML_codes[codeName]);
                });
            });
        })(key);
    });
}

setupMuseovirastoAPI();

app.listen(3000, () => console.log('Listening on port 3000!'));

