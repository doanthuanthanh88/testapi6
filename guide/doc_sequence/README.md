# Doc sequence
_Auto generate diagrams from any file which base on comment line_

# Features
1. Generate sequence diagram for each features base on comment line in code
2. Auto generate a flow diagram which describe how to our service run
3. Generate class diagram for data model base on comment line in code

# Installation
- Use with `vscode extension`
  - Install `doanthuanthanh88.testapi6`
- Use by command line
```sh
  npm install -g testapi6
```

# How to run

1. Prepare configuration file `gen_seq_doc.yaml`
```yaml
- DocSequence:
    title: My first service   # Service name
    ext:                      # Only scan files which file name endwiths these values
      - .ts
    excludes:                 # Ignore scan these folders
      - node_modules
    theme: default            # Default color in diagrams ("default", "forest", "dark", "neutral")
    slient: true              # Disable log
    src: ../../src            # Source path which includes code files
    saveTo: ./mmd             # Target path which includes the output document
    stack: false              # Auto generate number in sequence diagram
    autoNumber: false         # Activations can be stacked for same actor
    # fileTypes:
    #   js:
    #     excludes: ['node_modules', 'dist'],
    #     commentTag: '///'
    #   ts:
    #     excludes: ['node_modules', 'dist'],
    #     commentTag: '///'
```
2. Run
  - vscode extension
    1. Use shortcut
        ```sh
          ctrl+shift+t
          # OR
          cmd+opt+t
        ```
    2. `OR` Use file `.yaml`
        ```yaml
          - Dev:
            - Run Server: yarn dev
          - Sequence diagram:
            - Generate: ${PATH}/gen_seq_doc.yaml
        ```
  - CLI
    ```sh
      testapi6 ${PATH}/gen_seq_doc.yaml
    ```

# Components

1. Function
  - Default function
  - Startup function
2. Conditional
3. Loop
4. Parallel
5. Box

> __All of command always start by default `$COMMENT_LINE/`__
You can change `$COMMENT_LINE` in file `.yaml`

Default:
- `javascript` is `///`
- `typescript` is `///`
- `golang` is `///`
- `java` is `///`
- `python` is `#/`

## Function
_Includes actions to do something_

There are 2 function types:
1. `Default function`: Defined functions which will be called by startup functions or other functions
  - Syntax:
    ```typescript
      /// [function name] Description
    ```
  - Example:
    ```typescript
      /// [sayHello] This is hello function
      function sayHello(name: string) {
        console.log('Hello ' + name)
      }
    ```

2. `Startup function`: Defined functions which run at startup
  - Syntax:
    ```typescript
      /// []{Context} Description
      OR
      /// [] Description
    ```
    > `Context`: Default is `app`
  - Example:
    ```typescript
      /// []{Worker} Worker to handle test message
      function main() {
        ...
      }
    ```

### Actions
  - `Call a function`
    - Syntax:
      ```typescript
      /// [function name]
      ```
    - Example:
      ```typescript
      function main() {
        /// [sayHello]
        sayHello('world')
      }
      ```
  - `Step by step in a function`
    - Syntax:
      ```typescript
      /// {} ACTION [Target]: Start do something
      ...
      /// {} ACTION [Target]: Result after done
      ```
    - `ACTION`:
      > `>`: Call to a next step

      > `<`: Return after a step done

      > `=>`: Make call/request to a service
      
      > `x>`: Make call/request to a service `then stop`

      > `<=`: Return after a call/request done

      > `<x`: Return after a call/request done `then stop`

      > `->`: Publish a message

      > `<-`: Consume a message

    - `TARGET`:
      > `{}`: Is current context

      > `[Target]`: `[]` is described to database

      > `(Target)`: `()` is described to Redis, Kafka, RabbitMQ...

      > `{Target}`: `{}` is described to other services, client...

    - Example:
      ```typescript
      function main() {
        /// {} > [MySQL]: Get item by ID
        const item = await mysql.execute(...)
        /// {} < [MySQL]: Return Item{}

        /// {} > (Redis): Set name to cached
        await redis.set(...)
        /// {} < (Redis): Return

        /// {} => {Service 1}: Get items
        await fetch(...)
        /// {} <= {Service 1}: Return Item[]

        
        try {
          /// {Service 2} => {Service 1}: Get items
          await fetch(...)
        }
        /// IF get data from Service 1 error 
        catch (err) {
          /// {Service 2} <x {Service 1}: Throw 400 - Bad request
          throw new BadRequest(err.message)
        }
        /// {Service 2} <= {Service 1}: Return Item[]
      }
      ```

---

## Conditional
- Keywords: `IF` | `ELSE`
- Syntax:
  ```typescript
  /// IF description
    ...
  /// ELSE description
    ...
  /// ELSE description
    ...
  ```
- Example:
  ```typescript
  /// IF Env is stag
  if (env === 'stag') {
    console.log('stag')
  }
  /// ELSE Env is production
  else if(env === 'prod') {
    console.log('prod')
  }
  /// ELSE Env is dev
  else {
    console.log('dev')
  }
  ```

## For, loop
- Keywords: `LOOP`
- Syntax:
  ```typescript
  /// LOOP description
    ...
  ```
- Example:
  ```typescript
  /// LOOP Infinity to test
  while(true) {
    ...
  }
  ```

## Parallel tasks
- Keywords: `PARALLEL`
- Syntax:
  ```typescript
  /// PARALLEL
    /// Do task 1
      ...
    /// Do task 2
      ...
    /// Do task n
      ...
  ```
- Example:
  ```typescript
  /// PARALLEL
  await Promise.all([
    /// Get user
    fetch(...),
    /// [getClass] Get class
    Class.getClass()
    /// Get product
    ///   {} > {ProductService}: Get a product
    fetch(...),
    ///   {} < {ProductService}: Return Product{}
  ])
  ```
## Box
- Keywords: `BOX`
- Syntax:
  ```typescript
  /// BOX (RED, GREEN, BLUE)
    /// Do something here
      ...
  ```
- Example:
  ```typescript
  /// BOX (255, 0, 0)
  ///   LOOP Infinity to test
  while(true) {
    ...
  }
  ```

# Best practices
- [example result](../../test/examples/assets/seq_doc_comment/README.md)
- [example file](../test/examples/assets/doc_sequence.js)