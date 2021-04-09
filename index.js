const adminIp = "::ffff:1.116.89.100"
const steam = new SteamAPI('token');


const express = require('express')
const bodyParser = require('body-parser');
const SteamAPI = require("steamapi")
const fs = require("fs");
const path = require("path")

const app = express()


app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const parseIp = (req) =>
    (req?.connection?.remoteAddress)
    || req?.socket?.remoteAddress
    || req?.connection?.socket?.remoteAddress



var players = [/*
    steamId: "steam id",
    name: "name",
    skillGroup: "11",
    prime: "true",
    flag: "GB",
    ip: "ip",
    req: 0,
    date = 56485494984
*/]
var ipBlackList = [
    "::ffff:88.241.66.87",
    "::ffff:84.115.219.114"
]
var validAccounts = []
var invalidAccounts = []
var steamIdBlackList = []
var steamReqCounter = 0

try {
    validAccounts = JSON.parse(fs.readFileSync("./validAccounts.json", {encoding:'utf8', flag:'r'}))
} catch (err) { }

try {
    invalidAccounts = JSON.parse(fs.readFileSync("./invalidAccounts.json", {encoding:'utf8', flag:'r'}))
} catch (err) { }

try {
    steamIdBlackList = JSON.parse(fs.readFileSync("./steamIdBlacklist.json", {encoding:'utf8', flag:'r'}))
} catch(err) {
    steamIdBlackList = [
        "76561199103651236", 
        "76561199120128776",
        "76561198021520829",
        "76561198023414915",
        "76561197982036918",
        "76561198253139692"
    ]
    fs.writeFile("./steamIdBlacklist.json", JSON.stringify(steamIdBlackList), (err) => {})
}

app.all("/register", async (req,res) => {
    //Check if values are set
    if (!(req.body && req.body.steamId && req.body.name && req.body.skillGroup && req.body.prime && req.body.flag && req.body.token)) return res.send("Invalid request")

    var name = req.body.name
    var token = req.body.token
    const steamId = req.body.steamId
    const skillGroup = req.body.skillGroup
    const prime = req.body.prime
    const flag = req.body.flag
    const ip = parseIp(req)
    const count = 0
    const date = Date.now()
    
    
    //Validity check
    if (isNaN(steamId) || steamId.length > 20) return clown(req, res) //Steamid is number && has les than 20 digits
    if (name.length > 32) return clown(req, res) //Max name lenght is 32
    if (isNaN(skillGroup) || skillGroup.length > 2) return clown(req, res) //Skill group is 2 digit number
    if (!(prime == "false" || prime == "true")) return clown(req, res) //prime is always true/false
    if (flag.toUpperCase() !== flag || flag.length > 2) return clown(req, res) //flag is always uppercase && has les than 2 characters
    if (token.length !== 32) return clown(req, res)
    


    if (!req.headers["user-agent"]?.startsWith("Valve/Steam HTTP Client 1.0")) {
        console.log("Invalid header -> " + name + " -> " + ip);
        return res.send()
    }

    if (IsBlackListed(steamId, ip, count)) { //Check is ip/steamid is blacklisted
        //console.log("Blacklisted -> " + ip + " -> " + steamId)
        return res.send()
    }

    //Check if user is already added
    var index = ArrFindByKey(players, steamId, "steamId")
    if (index !== -1) {
        players[index].date = Date.now()
        players[index].count++
        return res.send("bumped")
    }

    //Check if another user does not have the same ip
    index = ArrFindByKey(players, ip, "ip")
    if (index !== -1) 
        if (players[index].steamId !== steamId) 
            return res.send()
    
    if (!(await CheckSteamAccountIfExists(steamId, name))) 
        return clown(req, res)
    

    //Fix for HTML injection and other stuff that breaks the script
    name = name.replace(/[<>:\n]/gm, "")
    token = token.replace(/[\W]/gm, "")

    const data = {
        steamId: steamId,
        name: name,
        skillGroup: skillGroup,
        prime: prime,
        flag: flag,
        ip: ip,
        count: count,
        date: date,
        token: token
    }
    players.push(data)

    //console.log({Registered: data});
    console.log("Registered -> " + name + " -> " + steamId + " -> " + ip);
    
    res.send("Success")
})

app.all("/unregister", (req,res) => {
    if (!(req.body && req.body.token && req.body.steamId)) return res.send("Invalid request")
    const token = req.body.token
    const steamId = req.body.steamId
    const ip = parseIp(req)

    var index = ArrFindByKey(players, token, "token")
    if (index == -1) return res.send("Not found")

    if (IsBlackListed(steamId, ip, players[index].count)) {
        console.log("Blacklisted -> " + ip + " -> " + steamId)
        return res.send()
    }

    console.log("Unregistered -> " + players[index].name + " -> " + ip)

    players.splice(index, 1)
    res.send("Unregistered")
})

app.all("/load", (req,res) => {
    if (!(req.body && req.body.steamId)) return res.send("Invalid request")
    const steamId = req.body.steamId
    const ip = parseIp(req)

    if (IsBlackListed(steamId, ip, 0)) {
        return res.send()
    }
    var result = ""
    for(let i = 0; i < players.length; i++) 
        result += `${players[i].steamId}:${players[i].name}:${players[i].skillGroup}:${players[i].prime}:${players[i].flag}\n`
    res.send(result)
})

app.all("/blacklist", (req,res) => {
    console.log(req.body);
    if (!(req.body && req.body.token)) return res.send()
    if (req.body.token !== "EpicTrolled123") return
    if (req.body.steamId) {
        BlacklistSteamId(req.body.steamId)
        res.send("Success")
    }
})

app.all("/admin", (req,res) => {
    if (parseIp(req) !== adminIp && parseIp(req) !== "::1") {
        console.log(parseIp(req));
        res.statusCode = 403
        return res.send()
    }
    res.sendFile(path.join(__dirname + '/admin.html'))
})

app.all("/get/players", (req, res) => {
    if (parseIp(req) !== adminIp && parseIp(req) !== "::1") {
        console.log(parseIp(req));
        res.statusCode = 403
        return res.send()
    }
    res.send(players)
})

app.all("/get/blacklist/steamid", (req, res) => {
    if (parseIp(req) !== adminIp && parseIp(req) !== "::1") {
        console.log(parseIp(req));
        res.statusCode = 403
        return res.send()
    }
    res.send(steamIdBlackList)
})

function clown(req, res) {
    console.log("Clown:")
    console.log(req.body)
    res.send()
}

function IsBlackListed(steamId, ip, count) {
    if (steamIdBlackList.includes(steamId)) return true
    if (ipBlackList.includes(ip)) return true
    if (count > 20) {
        steamIdBlackList.push(steamId)
        ipBlackList.push(ip)
        return true
    }
    return false
}

function ArrFindByKey(arr, val, key) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i][key] == val) return i
    }
    return -1
}

function Check() {
    for (let i = 0; i < players.length; i++)
        if ((Date.now() - players[i].date) > 60 * 1000) players.splice(i, 1)
}

async function CheckSteamAccountIfExists(steamId, name) {
    if (steamReqCounter > 10) return false
    return new Promise((resolve, reject) => {
        steamReqCounter++
        let index = ArrFindByKey(invalidAccounts, steamId, "steamId")
        if (index !== -1 && invalidAccounts[index].name == name) return resolve(false)
        index = ArrFindByKey(validAccounts, steamId, "steamId")
        if (index !== -1 && validAccounts[index].name == name) return resolve(true)
        steam.getUserSummary(steamId).then(res => {
            if (res.nickname == name && res.steamID == steamId) {
                AddValidAccount(steamId, name)
                return resolve(true)
            }
        return resolve(false)
        /*steamReqCounter++
        if (invalidSteamIds.indexOf(steamId) !== -1) return resolve(false)
        if (validSteamIds.indexOf(steamId) !== -1) return resolve(true)
        steam.getUserSummary(steamId).then(res => {
        if (res.nickname == name && steamId == res.steamID) {
            validSteamIds.push(steamId)
            return resolve(true)
        }
        return resolve(false)*/

    }).catch(err => {
        steamReqCounter++
        //invalidSteamIds.push(steamId)
        AddInvalidAccounts(steamId, name)
        return resolve(false)
    })
    })
    
}

function AddValidAccount(steamId, name) {
    validAccounts.push({
        steamId: steamId,
        name: name
    })
    fs.writeFile("./validAccounts.json", JSON.stringify(validAccounts), (err) => {})
}

function AddInvalidAccounts(steamId, name) {
    invalidAccounts.push({
        steamId: steamId,
        name: name
    })
    fs.writeFile("./invalidAccounts.json", JSON.stringify(invalidAccounts), (err) => {})
}

function BlacklistSteamId(steamId) {
    steamIdBlackList.push(steamId)
    fs.writeFile("./steamIdBlacklist.json", JSON.stringify(steamIdBlackList), (err) => {})
}

/*function BlacklistIp() {
}*/

setInterval(() => {steamReqCounter = 0}, 10*1000)
setInterval(Check, 60 * 1000)

app.listen(3000)
