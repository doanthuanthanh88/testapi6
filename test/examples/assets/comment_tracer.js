const EventEmitter = require("node:events")

// [HttpUser] namespace
class HttpUser {
  // [> getUser] 
  // [-] Service ->> UserService: Get user by id
  getUser(id) {
    if (id > 0)                 // [-] alt Check user id must be greater than 0
      return { name: 'thanh' }  // [-] Service -->> Service: Return user information
                                // [-] else
    return null                 // [-] Service -->> Service: Return null
  }                             // [-] end
  // [>]

  // [> getCompany]
  // [+ Service => CompanyService] Request to get company infor
  getCompany() {
    new EventEmitter().emit('redis', 'hello') // [+ Service -> Redis] Pub data
                                                 // [+ PARALLEL] Push to sync
    new EventEmitter().emit('rabbitmq', 'hello') // [+ Service -> RabbitMQ] Sync data
                                                 // [+ AND] DO SOMETHING
    new EventEmitter().emit('kafka', 'hello')    // [+ Service -> KAFKA] Sync data
                                                 // [+ END]
  }
  // [+ Service <= CompanyService] Return company info
  // [>]

  // [> worker]
  // [+ PAR] Start worker
  workerRun() {
    // [+ LOOP]
    while(true) {
      console.log('ok') // [+ Service] Do something here
    }
    // [+ END]
  }
  // [+ END]
  // [>]

  // [>> userController]
  // [+ Client > Service] Get user information
  userController() {
                                        // [+ NOTE_RIGHT:Service] note right here
                                        // [+ NOTE_LEFT:Service] note left here
                                        // [+ NOTE_OVER:Service,Redis] note over here
    this.workerRun()                    // [< worker]
    const user = this.getUser()         // [< getUser]
    const company = this.getCompany()   // [< getCompany]
    
    if (!user) {                        // [+ IF] User not existed
      console.log(user)                 // [+ Service] Print user to console
      for (const i = 0; i < 10; i++) {  // [+ LOOP] i from 0 to 10
        console.log(i)                  // [+ Service] Print i to console
      }                                 // [+ END]
    } else {                            // [+ ELSE] User existed
      return user                       // [+ Service] Return user
    }                                   // [+ END]
  }
  // [+ Client <- Service] Return user information
  // [>]

}