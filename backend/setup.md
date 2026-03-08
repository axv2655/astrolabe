You have to use bore.cli to get the server to work outside

(you need cargo)
`cargo install bore-cli` installs cli
`bore local 8000 --to bore.pub -p 12345` sets port 8000 to bore.pub:12345

This will then give you the address "<http://bore.pub:12345>". Set that in ur expo conf and ur good
