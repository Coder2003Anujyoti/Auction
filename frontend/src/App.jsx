import React,{useState,useEffect} from "react";
import {socket} from "./socket.js"
const App = () => {
const [name,setName]=useState("")
const [id,setId]=useState("")
const [msg,setMsg]=useState("")
const [player,setPlayer]=useState([])
const [data,setData]=useState([])
const [timer,setTimer]=useState(10)
const [disable,setDisable]=useState(false)
const [info,setInfo]=useState([])
const [bid,setBid]=useState(0)
const [subtimer,setSubtimer]=useState(5)
const [all,setAll]=useState([])
const [pl,setPl]=useState([])
const submit_data=()=>{
socket.emit("join-room",{name,id})
setName("")
setId("")
}
useEffect(()=>{
socket.on("wait",(m)=>{
setMsg(m.msg)
})
socket.on("start-game",(m)=>{
let val=m.players.filter((i)=>i.id==socket.id)
setPlayer(val)
setPl(m.players)
setData(m.auction)
setTimer(m.auction.timer)
setDisable(false)
setInfo([])
})
socket.on("timer",(count)=>{
setTimer(count)
})
socket.on("bid-update",(m)=>{
let vals=m.room.filter((i)=>i.id==socket.id)
if (m.bidders[m.bidders.length - 1] === vals[0].name){
setInfo(m.bidders)
setBid(m.bid)
setDisable(true)
}
else{
setInfo(m.bidders)
setBid(m.bid)
setDisable(false)
}
})
socket.on("updates",(m)=>{
let val=m.players.filter((i)=>i.id==socket.id)
setPlayer(val)
setData(m.data)
setPl(m.players)
setInfo([])
})
socket.on("round-end",(m)=>{
setSubtimer(m.nextIn)
})
socket.on("final-updates",(m,ack)=>{
setAll(m.players)
ack()
})
socket.on("Left",(m)=>{
setPlayer([])
setMsg(m)
})
return ()=>
socket.disconnect()
},[])
return (
<>
{ player.length == 0 && all.length == 0 && <>
<input type="text" placeholder="Enter Name"  value={name} onChange={(e)=>setName(e.target.value)}/>
<input type="text" placeholder="Enter ID"  value={id} onChange={(e)=>setId(e.target.value)}/>
<button onClick={submit_data} className="w-32 h-12 bg-stone-200">Submit</button>

  <p>{msg}</p>  
  </>}  
{ all.length == 0 && <>  
{ player.length > 0 && <>  
<img src={data.image} />  
<p>{data.name}</p>  
<p>{player[0].name}</p>  
<p>{player[0].purse}</p>  
{ timer > 0 && <>  
<h3>Live Bids</h3>  
{info.length > 0  && (  
  <div style={{  
    border: "2px solid green",  
    padding: "10px"  
  }}>  
    <p>👤 {info[info.length - 1]}-:{bid}</p>  
  </div>  
)}  
<p>{timer}</p>  
{ (disable == false && player[0].players.length < 5 && timer > 0 && player[0].purse>=bid && player[0].purse>0)&&   
  <button onClick={()=>{  
  socket.emit("move-bid",{name:player[0].name,id:player[0].roomID})  
  setDisable(true)  
  }} className="w-32 h-12 bg-stone-200">Bid</button>  
}  
</>}  
{  
  timer==0 && <>  
{ data.bidders.length > 0 ?  
  <p>{data.bidders[data.bidders.length-1]}-:{data.bid}</p> : <p>Unsold</p> }  
  <p>{subtimer}</p>  
  </>  
}  
{  
  pl.length > 0 && <>  
  <div>  
    {pl.map((i)=>{  
    return (<>  
    <p>{i.players.length}</p>  
    </>)  
    })}  
  </div>  
  </>  
}  
</>  
}  
</>}  
{all.length > 0 && <div>  
{all.map((i)=>{  
  return(<>  
  <div>  
  <p>{i.players.length}</p>  
  </div>  
  </>)  
})}  
</div> }  
  </>  
  );  
};
 export default App