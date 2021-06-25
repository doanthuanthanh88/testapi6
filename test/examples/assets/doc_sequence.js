const EventEmitter = require("events")
import { LogService } from './LogService'

class HttpUser {

  /// [HttpUser.getUser]
  async getUser(id, role) {
    /// IF is admin
    if (role === 'admin') {
      /// print the role to screen
      console.log('admin')
    }
    /// ELSE is not admin
    else {
      /// {} => {LogService}: Add log to server
      await LogService.logToServer(id, role)
    }

    /// LOOP in 10 times
    for (let i = 0; i < 10; i++) {
      /// print index to screen
      console.log(i)
    }

  }

  /// [HttpUser.getCompany]
  async getCompany() {
    /// {} -> {Redis}: Publish hello
    new EventEmitter().emit('redis', 'hello')
    /// {} => {LogService}: Make a request to add log
    await LogService.logToServer(1, 'fake_user')
    /// {} <- {RabbitMQ}: Comsume event              
    new EventEmitter().on('kafka', 'hello')
  }

  // Run with context is worker
  /// [workerRun]{Worker} Start a worker
  workerRun() {
    /// Loop infinity
    while (true) {
      /// Print ok to screen
      console.log('ok')
    }

  }

  // Run with context is app
  /// [] Begin write sequence diagram from here
  userController() {
    /// {Client} => {}: Request to run worker
    /// [workerRun]
    this.workerRun()

    /// note right of {Client}: Note client here
    /// parallel
    const [user, company] = await Promise.all([
      /// [HttpUser.getUser] Get user
      this.getUser('case admin'),
      /// [HttpUser.getCompany] Get company
      this.getCompany(),
    ])

    /// {Client} <= {}: Response "OK"
    return "OK"

  }

}