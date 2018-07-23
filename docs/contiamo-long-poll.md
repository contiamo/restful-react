# Motivation

Streaming events from servers to browsers is a big messy non-standardized problem. This spec will define _how_ Contiamo sends events from backend services to web-browsers. This can be used for streaming new logs from long running process or notify that the object being viewed has been changed.

In short, servers will implement long-polling [[1](https://en.wikipedia.org/wiki/Push_technology#Long_polling), [2](https://realtimeapi.io/hub/http-long-polling/)]. Clients will indicate a long-poll request using the [`Prefer` header](https://tools.ietf.org/html/rfc7240#section-4.3), servers will indicate the polling timeout with a [304 status code](https://httpstatuses.com/304), and payloads will be JSON.

Alternative implementations that a service and can support _in addition_ to long-polling are grpc streams [[1](https://grpc.io/docs/guides/concepts.html#server-streaming-rpc), [2](https://grpc.io/docs/tutorials/basic/node.html#streaming-rpcs)] or http streaming [[1](https://realtimeapi.io/hub/http-streaming/), [2](https://tools.ietf.org/id/draft-loreto-http-bidirectional-07.html#streaming)] with [new-line-delimited-json](http://ndjson.org/).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Implementation](#implementation)
  - [Endpoints](#endpoints)
  - [Flow](#flow)
  - [Request Headers](#request-headers)
  - [Response Headers](#response-headers)
    - [Response](#response)
  - [Status Codes](#status-codes)
- [Research Examples](#research-examples)
- [Specifications, Blogs, and other Documents](#specifications-blogs-and-other-documents)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Implementation

## Endpoints

Long polling will be implemented as an enhancement of existing REST/RPC endpoints, not as new polling specific endpoints. The API documentation must specify if the endpoint supports long-polling.

## Flow

HTTP long polling is a variation on the standard polling but with the distinction that the polling request are "long-lived". At Contiamo, the flow looks like this:

![Long Poll Flow](long-poll-flow.png)

## Request Headers

To start a long-polling request, Restful React makes an `HTTP GET` request and set the `Prefer` header with a wait value and an index value, e.g. `wait=60;index=abad123`. This is a number of seconds and a query "position". This value can be set at a maximum of 60 seconds, the minimum can be defined by the backend server, but is typically >5 seconds. The index will be a server defined and supplied value.

The `index` value is optional, if omitted, the request is processed exactly the same as a standard web request (meaning based on any `GET` parameters supplied). This `index` value should be read from the `X-Polling-Index` header in a previous response. When it is set, the server will use the value to wait for any changes subsequent to that index.

## Response Headers

On a successful `GET`, the server must set a head `X-Polling-Index`, this value is a unique identifier representing the current state of the resource. It is not required to have any specific structure or meaning for the client. Meaning that the client should not inspect the value for any specific information or structure. For example, this value could be datetime string of the last update, an int64 of the last object, or it could be a base64 encoded datetime string like `MjAxOC0wMS0wMVQwMDowMDowMFo=`. Whatever it is, the server is responsible for encoding and decoding this value to filter the query for changes from that index point.

### Response

In the absence of the `Prefer` header, the request will behave as normal, the backend service will immediately process and return a response as soon as it can.

When the `Prefer` header is set, the server will parse (and potentially normalize the value). It will process the request. The server will wait until a maximum of the `wait` value has elapsed _or_ it can fulfill the request. If the `wait` time elapses, it will send a `304` status code indicating that the request did not fail, but contains no data. If the server decides that it can fulfill the request, it response with a `200` status code and a JSON payload, as defined by the API docs for the endpoint.

Once the request has finished the client can then open a new request for more data.

## Status Codes

- `200` success
- `304` long poll timeout
- `4xx` request error
- `5xx` server error

This list is provided to highlight the distinction between the polling timeout response and other timeout responses like

- `[408 Request Timeout](https://httpstatuses.com/408)`
- `[504 Gateway Timeout](https://httpstatuses.com/504)`
- `[599 Network Connect Timeout Error](https://httpstatuses.com/599)`

These other statuses should be treated as errors.

# Research Examples

- [Console blocking queries](https://www.consul.io/api/index.html#blocking-queries)
- [Dropbox longpoll endpoints](https://www.dropbox.com/developers/documentation/http/documentation#files-list_folder-longpoll)

# Specifications, Blogs, and other Documents

- [Prefer header RFC](https://tools.ietf.org/html/rfc7240#section-4.3)
- [Realtime API hub docs](https://realtimeapi.io/hub/http-long-polling/)
