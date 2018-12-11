var express = require('express');
var app = express();
var mysql = require('mysql');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var moment = require('moment');
var multer = require('multer');
var dbconfig = require('./database');
var con = mysql.createPool(dbconfig.connection);

// Setting destination path and file name
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
       cb(null, 'public/images/recipeimages')
  },
  filename: function (req, file, cb) {
      let ext='.jpg';
      if(file.mimetype == 'image/jpeg')
          ext = '.jpg'
        else{
          ext = '.png'
        }
        var fname='';
        for(var i =0 ;req.body.name[i]!=' ';i++)
            fname+=req.body.name[i];
      cb(null, fname + '-' + Date.now()+ext);
    }
});

var upload = multer({ storage: storage })

app.use(cookieParser());
app.use(session(
  {
    secret: "Its a very secure channel",
   resave: true,
  saveUninitialized: true
}));
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.set("view engine", "ejs");
app.use(function(req, res, next) {
  res.locals.admin = req.session.admin;
  next();
});

app.use(express.static(__dirname + "/public"));


// Index Route
app.get('/',function(req,res){
  res.render('home');
});

// Route to show all the recipes
app.get('/recipes',function(req,res){
  con.getConnection(function(err,con) {
    if (err) {
      con.release();
      throw err;
    }
    console.log("Connected!");
    con.query("SELECT rid,name,image FROM recipe", function (err, result, fields) {
     if (err) throw err;
      res.render('recipes',{result:result});
   });
  });
});

function searchRecipe(name1,name2)
{
  let count=0;
  for(var i=0;i<name1.length && i< name2.length;i++)
  {
    if(name1[i] === name2[i]) count++;
  }
  let prob = (count/name2.length ) * 100;
  if(prob > 35) return true;
  else return false;
}


app.get('/ingredientsearch',function(req,res){
  con.getConnection(function(err,con) {
    if (err) {
      con.release();
      throw err;
    }
    console.log("Connected!");
    con.query("SELECT rid,name,image FROM recipe", function (err, result, fields) {
     if (err) throw err;
      res.render('ingredientsearch',{result:result});
   });
  });
});

app.post('/ingredientsearch',function(req,res){

  console.log(req.body);
  var ingredients = req.body.ingredients;
  console.log(ingredients.length);
  con.getConnection(function(err,con) {
    if (err)  {
      con.release();
      throw err;
    }
    var id=[];
    con.query('SELECT rid from ingredients where trim(ingredient) in (?) group by rid having count(*) = ?;',[ingredients,ingredients.length],function(err1, result1, fields){
      if (err1)  {
        con.release();
        throw err1;
      }
     result1.forEach(function(val){
        id.push(val.rid);
      });
      if(id.length > 0){
      con.query("SELECT rid,name,image FROM recipe where rid in (?)",[id], function (err, result, fields) {
       if (err) throw err;
        res.render('recipes',{result:result});
     });
   }
   else{
     con.query("SELECT rid,name,image FROM recipe", function (err, result, fields) {
      if (err) throw err;
       res.render('recipes',{result:result});
    });
   }
    });

});
});

//Route to search for the recipe
app.post('/search',function(req,res){

  let recname = req.body.search;
  //Create a connection
  con.getConnection(function(err,con) {
    if (err)  {
      con.release();
      throw err;
    }
    console.log("Connected!");
    let sresult = [];
    con.query("SELECT rid,name,image FROM recipe", function (err, result, fields) {
     if (err) {
       con.release();
       throw err;
     }
     console.log(result);
     result.forEach(function(value){
       if(searchRecipe(recname.toLowerCase(),value.name.toLowerCase()))
        sresult.push(value.rid);
     });
     if(sresult && sresult.length > 0)
     {
       con.query("SELECT rid,name,image FROM recipe where rid in (?);",[sresult],function(err1,result1,fields1){
         if(err1) throw err1;
          if(result1.length > 0)
          {
              res.render('recipes',{result:result1});
          }
       })
     }
     else
     {
       res.redirect('/recipes');
     }
   });
  });
});

// Route to handle admin Login
app.post('/adminlogin',function(req,res){
  let aname = req.body.admin_name;
  let passwd = req.body.passwd;
  con.getConnection(function(err,con){
    if(err)  {
      con.release();
      throw err;
    }
    con.query('SELECT name,password from adminlogin where name= ? and password= ?;',[aname,passwd],function(err1,result,fields){
      if(err1) throw err1;
      if(result.length > 0){
        console.log("Success");
        req.session.admin=aname;
        res.redirect('/recipes');
      }

      else{
          res.send("Incorrect username or password");
        }
    })
  })
});

//Route to show the admin login form
app.get('/adminlogin',function(req,res){
  res.render('adminlogin');
});

//Route to logout
app.get('/logout',function(req,res){
  req.session.destroy();
  res.redirect('/');
})

//Route to show the recipe form
app.get('/addrecipe',function(req,res){
  if(req.session.admin)
  {
    res.render('addrecipe');
  }
  else{
        res.render('adminlogin');
  }
});


app.post('/addrecipe',upload.single('img'),function(req,res){
  var pdate = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
  var rname = req.body.name;
  var rurl = req.body.url;
  var ingredients = req.body.ingredients;
  var directions = req.body.directions;
  var str = req.file.filename;
  var i = 0, strLength = str.length;
  for(; i < strLength; i++) {
    str = str.replace(" ", "_");
  }
  con.getConnection(function(err,con) {
    if (err)  {
      con.release();
      throw err;
    }
    console.log("Connected!");
    let query = "INSERT into recipe(name,url,date,image) values(?)";
    let rvalue = [rname,rurl,pdate,"images/recipeimages/"+req.file.filename];
    con.query(query, [rvalue], function (err1, result, fields) {
     if (err1) {
       con.release();
       throw err1;
     }
      let id = result.insertId;
      let query1 = "INSERT into recipe_direction values(?)";
      let dvalue = [id,directions];
      con.query(query1,[dvalue],function(err2,result1,fields){
        if(err2)  {
          con.release();
          throw err2;
        }
        console.log(result1);
        let query2 = "INSERT into ingredients values ?";
        let ivalue = [];
        ingredients.forEach(function(value){
          var temp=[];
          temp.push(id);
          temp.push(value.rcname);
          temp.push(value.quantity);
          ivalue.push(temp);
        });
        con.query(query2,[ivalue],function(err3,result2,fields2){
          if(err3) throw err3;
          console.log(result2);
        });
      });
   });
   res.redirect('/recipes');
});
});

//Route to show the recipe of particular id
app.get('/recipe/:id',function(req,res){

  //Create a connection
  con.getConnection(function(err,con) {
    if (err)  {
      con.release();
      throw err;
    }
    console.log("Connected!");
    con.query("SELECT r.rid,r.name,r.url,d.directions FROM recipe r, recipe_direction d where r.rid = d.rid and r.rid=?",[parseInt(req.params.id)], function (err1, result, fields) {
     if (err1)  {
       con.release();
       throw err1;
     }
     con.query("SELECT i.ingredient,i.quantity FROM  ingredients i where  i.rid=?",[parseInt(req.params.id)], function (err2, result1, fields1) {
     if (err2)  {
       con.release();
       throw err2;
     }
      res.render('recipe',{description:result,ingredients:result1});
   });
   });
 });
});

//Route to edit the recipe
app.post('/editrecipe/:id',upload.single('img'),function(req,res){
  if(req.session.admin)
  {
    var pdate = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
    var rname = req.body.name;
    var rurl = req.body.url;
    let ingredients = req.body.ingredients;
    var directions = req.body.directions;
    let rid = parseInt(req.params.id);
    if(req.file)
    {
        let img = "images/recipeimages/"+req.file.filename;
        let query = "update recipe set name = '"+ rname + "' , url = '"+ rurl+"' , date = '"+pdate +"' , image = '"+img +"' where rid = ?;";
        console.log(query);
         con.getConnection(function(err,con) {
           if (err)  {
             con.release();
             throw err;
           }
           console.log("Connected!");
           con.query(query,[parseInt(req.params.id)], function (err1, result, fields) {
             if(err1)  {
               con.release();
               throw err1;
             }
             con.query("update recipe_direction set directions = ? where rid = "+rid,[directions,parseInt(req.params.id)],function(err2,result1,fields1){
               if(err2)  {
                 con.release();
                 throw err2;
               }
               con.query("delete from ingredients where rid = ?",[parseInt(req.params.id)], function(err3,result2,fields2){
                 if(err3)  {
                   con.release();
                   throw err3;
                 }
                 let query2 = "INSERT into ingredients values ?";
                 let ivalue = [];
                 ingredients.forEach(function(value){
                   var temp=[];
                   temp.push(rid);
                   temp.push(value.rcname);
                   temp.push(value.quantity);
                   ivalue.push(temp);
                 });
                 con.query(query2,[ivalue],function(err3,result2,fields2){
                   if(err3)  {
                     con.release();
                     throw err3;
                   }
                   console.log(result2);
                   res.redirect('/recipe/'+req.params.id);
                 });
               });
             });
       });
     });
    }
    else{
    let  query = "update recipe set name = ?, url = ?, date = ? where rid = "+rid;
      con.getConnection(function(err,con) {
        if (err) {
          con.release();
          throw err;
        }
        console.log("Connected!");
        con.query(query,[rname,rurl,pdate], function (err1, result, fields) {
          if(err1)  {
            con.release();
            throw err1;
          }
          con.query("update recipe_direction set directions = ? where rid = "+rid,[directions],function(err2,result1,fields1){
            if(err2)  {
              con.release();
              throw err2;
            }
            con.query("delete from ingredients where rid = ?",[parseInt(req.params.id)], function(err3,result2,fields2){
              if(err3)  {
                con.release();
                throw err3;
              }
              let query2 = "INSERT into ingredients values ?";
              let ivalue = [];
              ingredients.forEach(function(value){
                var temp=[];
                temp.push(rid);
                temp.push(value.rcname);
                temp.push(value.quantity);
                ivalue.push(temp);
              });
              con.query(query2,[ivalue],function(err3,result2,fields2){
                if(err3)  {
                  con.release();
                  throw err3;
                }
                console.log(result2);
                res.redirect('/recipe/'+req.params.id);
              });
            });
          });
    });
  });
    }
}
});

app.get('/editrecipe/:id',function(req,res){
  if(req.session.admin)
  {

    //Create a connection
    con.getConnection(function(err,con) {
      if (err)  {
        con.release();
        throw err;
      }
      console.log("Connected!");
      con.query("SELECT r.rid,r.name,r.url,d.directions FROM recipe r, recipe_direction d where r.rid = d.rid and r.rid=?",[parseInt(req.params.id)], function (err1, result, fields) {
       if (err1)  {
         con.release();
         throw err1;
       }
       con.query("SELECT i.ingredient,i.quantity FROM  ingredients i where  i.rid=?",[parseInt(req.params.id)], function (err2, result1, fields1) {
       if (err2)  {
         con.release();
         throw err2;
       }
          res.render('editrecipe',{description:result,ingredients:result1});
     });
     });
   });
  }
  else
  {
        res.redirect('/adminlogin');
  }
});

app.listen(3000, function(){
  console.log("Server started!");
});
