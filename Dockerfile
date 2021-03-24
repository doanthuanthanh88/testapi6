FROM alpine

RUN apk add --no-cache nodejs-current yarn wrk bash
WORKDIR /test

ENV MODULES=

ADD "https://www.random.org/cgi-bin/randbyte?nbytes=10&format=h" skipcache
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN yarn global add testapi6 --prefix /usr/local/

ENTRYPOINT [ "/entrypoint.sh" ]
CMD ["/test"]

# docker run --rm -e "TERM=xterm-256color" -v $PWD:/scenario testapi6
