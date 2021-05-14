const EventEmitter = require("node:events")

// @ HttpUser
class HttpUser {
  
  // > getUser
  getUser(id) {
    // + IF: id > 0
    if (id > 0)    
      // - Return {name}
      return { name: 'thanh' }  
    // + ELSE: Return null         
    return null           
    // + END_IF      
  }
  // >
  
  // > getCompany
  getCompany() {
    // - Service -> Redis: Hello
    new EventEmitter().emit('redis', 'hello')    
    // - Service => RabbitMQ: hello                 
    new EventEmitter().emit('rabbitmq', 'hello') 
    // - Kafka <= Service: HEllo              
    new EventEmitter().emit('kafka', 'hello')    
  }
  // >
  
  // >> workerRun
  workerRun() {
    // + LOOP: Forever
    while(true) {
      // - Log ok
      console.log('ok') 
    }
    // + END_LOOP
    
  }
  // >
  
  // >> userController
  // - Client => Service: Add something
  userController() {
    // + PARALLEL: Run worker                            
    // < workerRun
    this.workerRun()
    // + END_PARALLEL

    // < getUser  
    const user = this.getUser()         
    // < getCompany
    const company = this.getCompany()   
    // + IF: Not user
    if (!user) {                       
      // - Log user 
      console.log(user)                 
      // + LOOP: i in 10
      for (const i = 0; i < 10; i++) {  
        // - Log i
        console.log(i)                  
      }                 
      // + END_LOOP                
    } else {                   
      // + ELSE: return user         
      return user                       
    }
    // + END_IF
    // + NOTE: Here
  }
  // - Client <= Service: Return user
  // >
  
  

}