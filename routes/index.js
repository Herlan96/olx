var express = require('express');
var router = express.Router();
var path = require('path');
const bcrypt = require('bcrypt');
const app = require('../app');
const { query } = require('express');
const saltRounds = 10;

module.exports = function (db) {
  function isloggedIn(req, res, next) {
    if (req.session.user) {
      next();
    } else {
      res.redirect('/login')
    }
  }

  router.get('/login', function (req, res) {
    res.render('login')
  })

  router.post('/login', function (req, res) {
    const email = req.body.email
    const password = req.body.password


    db.query('select * from users where email = $1 and password = $2', [email, password], (err, user) => {
      console.log(user)
      if (err) {
        return res.send('login Gagal')
      }
      if (!user.rows[0]) {
        return res.send('Email / Password')
      }
      req.session.user = user.rows[0];
      console.log(req.session.user)
      res.redirect('/')
    })
  })


  router.get('/register', function (req, res) {
    res.render('register')
  })

  router.post('/register', function (req, res) {
    const email = req.body.email
    const password = req.body.password
    const fullname = req.body.fullname

    bcrypt.hash(password, saltRounds, function (err, hash) {
      db.query('insert into users (email, password, fullname) values ($1, $2, $3)', [email, hash, fullname], (err, user) => {
        console.log(err)
        if (err) return res.send('register gagal')
        res.redirect('/login')

      })
    })
  })

  router.get('/logout', function (req, res) {
    req.session.destroy(function (err) {
      res.redirect('/login')
    })

  })

  router.get('/', function (req, res) {

    const url = req.url == '/' ? '/?page=1&sortBy=id&sortMode=asc' : req.url

    const user = { id: 1, fullname: 'Herlan' }

    const params = []

    params.push(`userid = ${user.id}`)

    if (req.query.task) {
      params.push(`task like '%${req.query.task}%'`)
    }

    if (req.query.complete) {
      params.push(`complete = ${req.query.complete}`)
    }

    const page = req.query.page || 1
    const limit = 3
    const offset = (page - 1) * limit
    let sql = 'select count(*) as total from todo';
    if (params.length > 0) {
      sql += ` where ${params.join(' and ')}`
    }
    db.query(sql, (err, row) => {
      const pages = Math.ceil(row.rows[0].total / limit)
      sql = 'select * from todo'
      if (params.length > 0) {
        sql += ` where ${params.join(' and ')}`
      }
      req.query.sortMode = req.query.sortMode || 'asc';

      req.query.sortBy = req.query.sortBy || 'id';

      sql += ` order by ${req.query.sortBy} ${req.query.sortMode}`

      sql += ' limit $1 offset $2'

      db.query(sql, [limit, offset], (err, rows) => {
        //return res.send(rows.rows)

        if (err) return res.send(err)
        res.render('list', {
          data: rows.rows,
          page,
          pages,
          query: req.query, url,
          user: user,
          successMessage: req.flash('successMessage')
        })
      })
    })
  })

  router.get('/add', isloggedIn, function (req, res) {
    res.render('add')
  })

  router.post('/add', isloggedIn, function (req, res) {
    let task = req.body.task
    // query binding
    db.query(`insert into todo(task, userid) values ($1, $2)`, [task, req.session.user.id], (err) => {
      if (err) return res.send(err)
      res.redirect('/')
    });

  })

  router.get('/delete/:id', isloggedIn, function (req, res) {
    const id = req.params.id
    db.query(`delete from todo where id = $1`, [Number(id)], (err) => {
      console.log(err)
      if (err) return res.send(err)
      req.flash('successMessage', `ID : ${id} berhasil dihapus`)
      res.redirect('/')
    });
  })

  router.get('/edit/:id', isloggedIn, function (req, res) {
    const id = req.params.id
    db.query(`select * from todo where id = $1`, [Number(id)], (err, item) => {
      if (err) return res, send(err)
      res.render('edit', { data: item.rows[0] })
    });
  })

  router.post('/edit/:id', isloggedIn, function (req, res) {
    console.log(req)
    const id = Number(req.params.id)
    const task = req.body.task
    const complete = JSON.parse(req.body.complete)

    if (!req.files || Object.keys(req.files).length === 0) {
      db.query(`update todo set task = $1, complete = $2 where id = $3`, [task, complete, id], (err) => {
        if (err) return res.send(err)
        res.redirect('/')
      });
    } else {
      const file = req.files.picture;
      const fileName = `${Date.now()}-${file.name}`
      uploadPath = path.join(__dirname, '..', 'public', 'images', fileName);

      // Use the mv() method to place the file somewhere on your server
      file.mv(uploadPath, function (err) {
        if (err) {
          console.log(err)
          return res.status(500).send(err);
        }
        db.query(`update todo set task = $1, complete = $2, picture = $3 where id = $4`, [task, complete, fileName, id], (err) => {
          console.log(err)
          res.redirect('/')
        });
      });
    }
  })

  router.get('/upload', function (req, res) {
    res.render('upload')
  })

  router.post('/upload', function (req, res) {
    let sampleFile;
    let uploadPath;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    file = req.files.sampleFile;
    uploadPath = path.join(__dirname, '..', 'public', 'images', 'avatar.jpg');

    // Use the mv() method to place the file somewhere on your server
    file.mv(uploadPath, function (err) {
      if (err)
        return res.status(500).send(err);

      res.redirect('/upload')
    });
  });

  return router;
}