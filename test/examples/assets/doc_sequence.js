const EventEmitter = require("events")
import { LogService } from './LogService'

/// <User> User model in Database
class User {
  /// id number
  id: number
  /// name string: user name 
  name: string
  /// birth object: birthday
  birth: {
    /// day number: day of month
    day: number,
    /// month number: month of year
    month: number,
    /// year number: full year
    year: number,
    /// timezone object: Time zone here
    timezone: {
      /// name string: time zone name
      name: string
    }
  }
}

/// <Room> Room model
class Room {
  /// name string: Room name
  name: string
  /// user_ids User.id[]: List user in room
  user_ids: User.id[]
  /// creator_id User.id: First user create the room
  creator_id: User.id
}

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