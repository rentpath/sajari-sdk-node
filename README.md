# sajari-node

> node sdk for the Sajari API

```bash
$ yarn add sajari-node
```

```js
const { Client, Session, TrackingNone } = require("sajari-node");

const client = new Client("<project>", "<collection>", {
	key: "<key from console>",
	secret: "<secret from console>"
});
const session = new Session(TrackingNone);
const pipeline = client.pipeline("website");

pipeline.search({ q: "hello world" }, session)
	.then(response => {/* handle response ... */})
	.catch(error => {/* handle error ... */})
```


## License
[MIT](LICENSE)