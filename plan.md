Guakamole plan
=============
1. public folder (www) 
	-a  BTC = remove, 1 DIGO = 1000 Bits
	-b  style, icons, check html code
	-c  check menus, remove all copay label
	-d  personalization form. (save info to device temporary)

2. external components, clone from private repo. change bower
~~~
node_modules/bitcore-wallet-client/node_modules/bitcore-lib/bitcore-lib.js:  networkMagic: 0x968c8269,
node_modules/bitcore-wallet-client/node_modules/bitcore-lib/lib/networks.js:  networkMagic: 0x968c8269,
node_modules/bitcore-wallet-client/bitcore-wallet-client.js:  networkMagic: 0x968c8269,
bower_components/angular-bitcore-wallet-client/angular-bitcore-wallet-client.js:  networkMagic: 0x968c8269,
angular-bitcore-wallet-client/angular-bitcore-wallet-client.js:  networkMagic: 0x968c8269,
~~~
- netowrok magic (4 params)
- bws url
- ?!? BTC - DIGO

3. cordova folder (change project properties to indigo)

