install
=============
1. do ``git clone https://github.com/bitpay/copay.git``
(1.6.3) maybe 1.7 also will work

2. ``git checkout tags/v1.8.3``

3. from the doc:
....
Install bower and grunt if you haven't already:
~~~
npm install -g cordova
npm install -g bower
npm install -g grunt-cli
~~~

4. Build Copay:

~~~
bower install
npm install
grunt

~~~

5. edit required files (magicbytes ``find . | grep 0xf9beb4d9 -R``)!

change the url!(need to test!!!)
~~~
find -type f -name '*.js' | xargs sed -i 's/https:\/\/bws.bitpay.com\/bws\/api/http:\/\/poynt3.local:3232\/bws\/api/g'
~~~

6. start the app
~~~
npm start
~~~


** PART2  **
android apk

1. install Orcale Java 8 (execute step by step commands!)
~~~
sudo apt-get install python-software-properties
sudo add-apt-repository ppa:webupd8team/java
sudo apt-get update

sudo apt-get install oracle-java8-installer
~~~

Редактируем ``/etc/environment`` и добавляем нужный путь ``JAVA_HOME=/usr/lib/jvm/java-8-oracle``


2. somehow install android SKD! (unzip tar zxvf)
~~~
wget http://dl.google.com/android/android-sdk_r24.3.4-linux.tgz
tar -zxvf android-sdk_r24.3.4-linux.tgz
~~~

~~~
we need:
1. "SDK Platform" for android-21
2. "Android SDK Platform-tools (latest)
3. "Android SDK Build-tools" (latest)]

tools/android list sdk --all
tools/android update sdk -u -a -t 28,3,4,26

sudo nano /etc/environment
~~~

add: ``ANDROID_HOME=/opt/androidSdk/android-sdk-linux``

~~~
sudo apt-get install lib32stdc++6 lib32z1
~~~

3. install missing parts
~~~
sudo npm install -g bplist-parser
sudo npm install -g minimatch
sudo npm install -g inherits
sudo npm install -g path-is-absolute
sudo npm install -g inflight
sudo npm install -g once
~~~

4. from clientapp folder:
~~~
*** Warning *** make android-prod *** only first time, will erase all stuff.
~~~
ordinary build:
~~~
cd /home/tairbm/Work/poynt/clientapp/cordova/project
cordova build android --release
~~~

TROUBLES
in case something getting broken, here is manual install:
~~~
fix in cordova/build.sh
like this:
cordova plugin add https://github.com/Paldom/SpinnerDialog.git
~~~

in case we have ``failed to find target with hash string 'android-23'``
simple remove .gradle from home folder.

======================================================================
keystore things:
~~~
keytool -genkey -v -keystore ~/.android/debug.keystore -sigalg MD5withRSA -keyalg RSA -keysize 1024 -storepass android -alias androiddebugkey -keypass android -dname "CN=Android Debug,O=Android,C=US"
~~~

finalize building (android):
~~~
cd /opt/reactor/copay-1.8.3/

rm cordova/project/platforms/android/build/outputs/apk/android-release-signed-aligned.apk

rm cordova/project/platforms/android/build/outputs/apk/android-release-signed.apk

jarsigner -verbose -sigalg MD5withRSA -digestalg SHA1 -keystore ~/.android/debug.keystore -signedjar cordova/project/platforms/android/build/outputs/apk/android-release-signed.apk  cordova/project/platforms/android/build/outputs/apk/android-release-unsigned.apk androiddebugkey 

/opt/androidSdk/android-sdk-linux/build-tools/23.0.2/zipalign -v 4 cordova/project/platforms/android/build/outputs/apk/android-release-signed.apk cordova/project/platforms/android/build/outputs/apk/android-release-signed-aligned.apk

cp cordova/project/platforms/android/build/outputs/apk/android-release-signed-aligned.apk cordova/project/platforms/android/build/outputs/apk/download/digotest.apk
~~~

copy apk to shared folder
~~~
cp cordova/project/platforms/android/build/outputs/apk/android-release-signed-aligned.apk ~/poynt/clientApk/digo.apk
~~~

customizing:
1. overwrite android/res folder
2. created symlink to ~/poynt/cordova-client/www
3. edited config.xml (set names and descr)

