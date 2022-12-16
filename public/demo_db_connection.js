var mysql = require('mysql');
let dbconnection = mysql.createConnection({
        host: 'dccia.ml',
        user: 'ltqffwvi_tiktok',
        password: 'YoMama11785!',
        database: 'ltqffwvi_tiktok'
    });
con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});
