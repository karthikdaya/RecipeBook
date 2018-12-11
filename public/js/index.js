var time=3500;
var images=[];
var i=0;
for(var j=1;j<8;j++)
{
  images[j-1]='../images/cookingquote'+j+'.jpg';
}

function changeImg(){
  document.slide.src=images[i];

  if(i < images.length - 1){
      i++;
  }
  else{
    i=0;
  }
  setTimeout("changeImg()",time);
}
window.onload = changeImg;
