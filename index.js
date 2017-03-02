const http = require('http')
const port = 8010

const requestHandler = (req, res) => {
    console.log(req.url)
    res.end('this seems to work')
}

const server = http.createServer(requestHandler)

server.listen(port, (err) => {
    if(err) {
        return console.log('this looks ominous!', err)
    }

    console.log(`server listening on port ${port}`)
})
