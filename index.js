const express = require('express')
const app = express()
const port = 8000
var morgan = require('morgan');  // Logging middleware
app.use(morgan('dev'));

app.use('/',express.static(__dirname));
app.set('view engine', 'ejs');
app.set('views', __dirname);

app.get('/', (request, response) => {
    response.render('index', {
      what: 'World',
    });
  });

app.get('/sandbox-static/', (request, response) => {
    response.render('sandbox-static/index', {
      what: 'World',
    });
  });

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})