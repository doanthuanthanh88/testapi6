# testapi6
Quick unit test and export document APIs base on scenario file (yaml)

# Features
1. Test APIs base on scenario files
2. Validate response data, response headers...
3. Re-use variable after each steps
4. Split a big testcases to many smaller testcases which make easy testing for large project
5. Easy to extends for specific project
6. Load external library () and create tags by yourself
7. Support run benchmark via wrk

# External modules
1. [Redis](https://github.com/doanthuanthanh88/testapi6-redis): _Execute redis commands_
2. [Sql](https://github.com/doanthuanthanh88/testapi6-sql): _Execute mysql, postgres... query_
2. [Mongo](https://github.com/doanthuanthanh88/testapi6-mongo): _Execute mongo query command_
3. [MockApi](https://github.com/doanthuanthanh88/testapi6-mockapi) _Create mocking api and serve static files_
3. [gRPC](https://github.com/doanthuanthanh88/testapi6-grpc) _Create a gRPC server to mock data and gRPC client to call others_

# Practice
- See [examples](./test)
- Read [document details](https://doanthuanthanh88.github.io/testapi6/)

# How to use

## Use via CLI
```javascript
// install via npm
npm install -g testapi6
// OR install via yarn
yarn global add testapi6 --prefix /usr/local
```
## Use in Visual Code
- Search extension `testapi6` then install
- After installed, open .yaml file then `ctr+shift+t` or `command+option+t`

### Run test
```sh
testapi6 \"$PWD/$PATH_OF_SCENARIO_YAML_FILE\"
```

### Env variable
The environment variables always only overide `vars` in Testcase file

### Scenario
```yaml
title:                      # Document title
description:                # Document description
developer: email@gmail.com  # Author
version: 1.0.0              # Document version
servers:                  # Example server in document
  production: https://prod.abc.vn/my-service/v1.0
  staging: https://staging.abc.vn/my-service/v1.0
  development: http://localhost:3001
# debug: true
vars:                               # Declare global variables
  url: http://0.0.0.0:3001
templates:                          # Declare templates which not run
  # Make request
  - Api:
  - Get:
  - Post:
  - Put:
  - Patch:
  - Delete:
  - Head:
  - Group:
steps:
  # Make request
  - Api:            # REST API
  - Get:            # API GET method
  - Delete:         # API DELETE method
  - Head:           # API HEAD method
  - Post:           # API POST method
  - Put:            # API PUT method
  - Patch:          # API PATCH method
  # Print
  - Echo:           # Print data
  - Schema:         # Print object schema
  # Logic
  - Script:         # Inject javascript in scenario
  - Vars:           # Declare global variables
  - Regex:          # Handle regex string
  # Validate
  - Validate:       # Validate logic
  - Validator:      # Create a new validator
  # Common
  - Pause:          # Pause or delay calls
  - Import:         # Import files
  - Load:           # Load data file then assign the value to a variable
  - Require:        # Load external module or embed code to create a new tags
  - Group:          # Group steps to manage
  - Exec:           # Execute external command
  - Utils:          # Utility functions
  - Define:         # Declare new Utils/Validate/Vars
  - Input:          # Get user input keyboard
  - OutputFile:     # Save data to file
  - DocSwagger:     # Save to swagger document
  - DocMarkdown:    # Save to markdown document
  ...
```

### Scenario schema
[Ref to schema](./schema.json)

### Example

[Examples](./test)

### Run with docker

```sh
  # Always pull new image
  docker pull doanthuanthanh88/testapi6

  # Run test without password
  docker run --rm -v $PWD/benchmark.yaml:/test/index.yaml \
    -e {var_name_1}={value} \ # This variable will overide vars which is declared in testcase/vars
    -e URL=http://urlhere... \
    doanthuanthanh88/testapi6
  # Run test with password
  docker run --rm -v $PWD/benchmark.yaml.encrypt:/test/index.yaml.encrypt \
    -e {var_name_1}={value} \ # This variable will overide vars which is declared in testcase/vars
    -e URL=http://urlhere... \
    doanthuanthanh88/testapi6 \
    {password_here}
  # Run with external libraries
  docker run --rm -it -e MODULES="testapi6-mockapi testapi6-sql" -v $PWD/test/examples/mock_data.yaml:/test/index.yaml doanthuanthanh88/testapi6
```
