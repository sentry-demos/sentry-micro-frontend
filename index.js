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
      example_var: 'hello world',
    });
  });

app.get('/sandbox-basic/', (request, response) => {
    response.render('sandbox-basic/index', {
      example_var: 'Hello World',
    });
  });

app.listen(port, () => {
  console.log(`Sentry Micro-Frontend Sandbox is being served at http://localhost:${port}/ ...`)
})