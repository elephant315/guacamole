'use strict';

angular.module('copayApp.controllers').controller('walletHomeController', function($scope, $rootScope, $timeout, $filter, $modal, $log, notification, txStatus, isCordova, isMobile, profileService, lodash, configService, rateService, storageService, bitcore, isChromeApp, gettext, gettextCatalog, nodeWebkit, addressService, ledger, bwsError, confirmDialog, txFormatService, animationService, addressbookService, go, feeService, txSignService) {

  var self = this;
  window.ignoreMobilePause = false;
  $rootScope.hideMenuBar = false;
  $rootScope.wpInputFocused = false;
  var config = configService.getSync();
  var configWallet = config.wallet;

  // INIT
  var walletSettings = configWallet.settings;
  this.unitToSatoshi = walletSettings.unitToSatoshi;
  this.satToUnit = 1 / this.unitToSatoshi;
  this.unitName = walletSettings.unitName;
  this.alternativeIsoCode = walletSettings.alternativeIsoCode;
  this.alternativeName = walletSettings.alternativeName;
  this.alternativeAmount = 0;
  this.unitDecimals = walletSettings.unitDecimals;
  this.isCordova = isCordova;
  this.addresses = [];
  this.isMobile = isMobile.any();
  this.isWindowsPhoneApp = isMobile.Windows() && isCordova;
  this.blockUx = false;
  this.isRateAvailable = false;
  this.showScanner = false;
  this.addr = {};
  this.lockedCurrentFeePerKb = null;

  var disableScannerListener = $rootScope.$on('dataScanned', function(event, data) {
    self.setForm(data);
    $rootScope.$emit('Local/SetTab', 'send');

    var form = $scope.sendForm;
    if (form.address.$invalid && !self.blockUx) {
      self.resetForm();
      self.error = gettext('Could not recognize a valid Bitcoin QR Code');
    }
  });

  var disablePaymentUriListener = $rootScope.$on('paymentUri', function(event, uri) {
    $rootScope.$emit('Local/SetTab', 'send');
    $timeout(function() {
      self.setForm(uri);
    }, 100);
  });

  var disableAddrListener = $rootScope.$on('Local/NeedNewAddress', function() {
    self.setAddress(true);
  });

  var disableFocusListener = $rootScope.$on('Local/NewFocusedWallet', function() {
    self.addr = {};
    self.resetForm();
  });

  var disableResumeListener = $rootScope.$on('Local/Resume', function() {
    // This is needed then the apps go to sleep
    self.bindTouchDown();
  });

  var disableTabListener = $rootScope.$on('Local/TabChanged', function(e, tab) {
    // This will slow down switch, do not add things here!
    switch (tab) {
      case 'receive':
        // just to be sure we have an address
        self.setAddress();
        break;
      case 'send':
        self.resetError();
    };
  });

  var disableOngoingProcessListener = $rootScope.$on('Addon/OngoingProcess', function(e, name) {
    self.setOngoingProcess(name);
  });

  $scope.$on('$destroy', function() {
    disableAddrListener();
    disableScannerListener();
    disablePaymentUriListener();
    disableTabListener();
    disableFocusListener();
    disableResumeListener();
    disableOngoingProcessListener();
    $rootScope.hideMenuBar = false;
  });

  this.onQrCodeScanned = function(data) {
    if (data) go.send();
    $rootScope.$emit('dataScanned', data);
  };

  rateService.whenAvailable(function() {
    self.isRateAvailable = true;
    $rootScope.$digest();
  });

  var accept_msg = gettextCatalog.getString('Accept');
  var cancel_msg = gettextCatalog.getString('Cancel');
  var confirm_msg = gettextCatalog.getString('Confirm');

  this.openDestinationAddressModal = function(wallets, address) {
    $rootScope.modalOpened = true;
    var fc = profileService.focusedClient;
    self.lockAddress = false;
    self._address = null;

    var ModalInstanceCtrl = function($scope, $modalInstance) {
      $scope.wallets = wallets;
      $scope.editAddressbook = false;
      $scope.addAddressbookEntry = false;
      $scope.selectedAddressbook = {};
      $scope.newAddress = address;
      $scope.walletName = fc.credentials.walletName;
      $scope.color = fc.backgroundColor;
      $scope.addressbook = {
        'address': ($scope.newAddress || ''),
        'label': ''
      };

      $scope.beforeQrCodeScann = function() {
        $scope.error = null;
        $scope.addAddressbookEntry = true;
        $scope.editAddressbook = false;
      };

      $scope.onQrCodeScanned = function(data, addressbookForm) {
        $timeout(function() {
          var form = addressbookForm;
          if (data && form) {
            data = data.replace('bitcoin:', '');
            form.address.$setViewValue(data);
            form.address.$isValid = true;
            form.address.$render();
          }
          $scope.$digest();
        }, 100);
      };

      $scope.selectAddressbook = function(addr) {
        $modalInstance.close(addr);
      };

      $scope.toggleEditAddressbook = function() {
        $scope.editAddressbook = !$scope.editAddressbook;
        $scope.selectedAddressbook = {};
        $scope.addAddressbookEntry = false;
      };

      $scope.toggleSelectAddressbook = function(addr) {
        $scope.selectedAddressbook[addr] = $scope.selectedAddressbook[addr] ? false : true;
      };

      $scope.toggleAddAddressbookEntry = function() {
        $scope.error = null;
        $scope.addressbook = {
          'address': ($scope.newAddress || ''),
          'label': ''
        };
        $scope.addAddressbookEntry = !$scope.addAddressbookEntry;
      };

      $scope.list = function() {
        $scope.error = null;
        addressbookService.list(function(err, ab) {
          if (err) {
            $scope.error = err;
            return;
          }
          $scope.list = ab;
        });
      };

      $scope.add = function(addressbook) {
        $scope.error = null;
        $timeout(function() {
          addressbookService.add(addressbook, function(err, ab) {
            if (err) {
              $scope.error = err;
              return;
            }
            $rootScope.$emit('Local/AddressbookUpdated', ab);
            $scope.list = ab;
            $scope.editAddressbook = true;
            $scope.toggleEditAddressbook();
            $scope.$digest();
          });
        }, 100);
      };

      $scope.remove = function(addr) {
        $scope.error = null;
        $timeout(function() {
          addressbookService.remove(addr, function(err, ab) {
            if (err) {
              $scope.error = err;
              return;
            }
            $rootScope.$emit('Local/AddressbookUpdated', ab);
            $scope.list = ab;
            $scope.$digest();
          });
        }, 100);
      };

      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };

      $scope.selectWallet = function(walletId, walletName) {
        $scope.gettingAddress = true;
        $scope.selectedWalletName = walletName;
        $timeout(function() {
          $scope.$apply();
        });
        addressService.getAddress(walletId, false, function(err, addr) {
          $scope.gettingAddress = false;

          if (err) {
            self.error = err;
            $modalInstance.dismiss('cancel');
            return;
          }

          $modalInstance.close(addr);
        });
      };
    };

    var modalInstance = $modal.open({
      templateUrl: 'views/modals/destination-address.html',
      windowClass: animationService.modalAnimated.slideUp,
      controller: ModalInstanceCtrl,
    });

    var disableCloseModal = $rootScope.$on('closeModal', function() {
      modalInstance.dismiss('cancel');
    });

    modalInstance.result.finally(function() {
      $rootScope.modalOpened = false;
      disableCloseModal();
      var m = angular.element(document.getElementsByClassName('reveal-modal'));
      m.addClass(animationService.modalAnimated.slideOutDown);
    });

    modalInstance.result.then(function(addr) {
      if (addr) {
        self.setForm(addr);
      }
    });
  };

  var GLIDERA_LOCK_TIME = 6 * 60 * 60;
  // isGlidera flag is a security measure so glidera status is not
  // only determined by the tx.message
  this.openTxpModal = function(tx, copayers, isGlidera) {
    $rootScope.modalOpened = true;
    var fc = profileService.focusedClient;
    var currentSpendUnconfirmed = configWallet.spendUnconfirmed;
    var ModalInstanceCtrl = function($scope, $modalInstance) {
      $scope.error = null;
      $scope.copayers = copayers
      $scope.copayerId = fc.credentials.copayerId;
      $scope.canSign = fc.canSign() || fc.isPrivKeyExternal();
      $scope.loading = null;
      $scope.color = fc.backgroundColor;
      $scope.isShared = fc.credentials.n > 1;

      // ToDo: use tx.customData instead of tx.message
      if (tx.message === 'Glidera transaction' && isGlidera) {
        tx.isGlidera = true;
        if (tx.canBeRemoved) {
          tx.canBeRemoved = (Date.now() / 1000 - (tx.ts || tx.createdOn)) > GLIDERA_LOCK_TIME;
        }
      }
      $scope.tx = tx;
      $scope.currentSpendUnconfirmed = currentSpendUnconfirmed;

      $scope.getShortNetworkName = function() {
        return fc.credentials.networkName.substring(0, 4);
      };
      lodash.each(['TxProposalRejectedBy', 'TxProposalAcceptedBy', 'transactionProposalRemoved', 'TxProposalRemoved', 'NewOutgoingTx', 'UpdateTx'], function(eventName) {
        $rootScope.$on(eventName, function() {
          fc.getTx($scope.tx.id, function(err, tx) {
            if (err) {

              if (err.code && err.code == 'TX_NOT_FOUND' &&
                (eventName == 'transactionProposalRemoved' || eventName == 'TxProposalRemoved')) {
                $scope.tx.removed = true;
                $scope.tx.canBeRemoved = false;
                $scope.tx.pendingForUs = false;
                $scope.$apply();
                return;
              }
              return;
            }

            var action = lodash.find(tx.actions, {
              copayerId: fc.credentials.copayerId
            });
            $scope.tx = txFormatService.processTx(tx);
            if (!action && tx.status == 'pending')
              $scope.tx.pendingForUs = true;
            $scope.updateCopayerList();
            $scope.$apply();
          });
        });
      });

      $scope.updateCopayerList = function() {
        lodash.map($scope.copayers, function(cp) {
          lodash.each($scope.tx.actions, function(ac) {
            if (cp.id == ac.copayerId) {
              cp.action = ac.type;
            }
          });
        });
      };

      $scope.sign = function(txp) {
        var fc = profileService.focusedClient;
        $scope.error = null;
        $scope.loading = true;

        txSignService.prepareAndSignAndBroadcast(txp, {
          reporterFn: self.setOngoingProcess.bind(self)
        }, function(err, txp) {
          $scope.loading = false;
          $scope.$emit('UpdateTx');

          if (err) {
            $scope.error = err;
            $timeout(function() {
              $scope.$digest();
            });
            return;
          }
          $modalInstance.close(txp);
          return;
        });
      };

      $scope.reject = function(txp) {
        self.setOngoingProcess(gettextCatalog.getString('Rejecting payment'));
        $scope.loading = true;
        $scope.error = null;
        $timeout(function() {
          fc.rejectTxProposal(txp, null, function(err, txpr) {
            self.setOngoingProcess();
            $scope.loading = false;
            if (err) {
              $scope.$emit('UpdateTx');
              $scope.error = bwsError.msg(err, gettextCatalog.getString('Could not reject payment'));
              $scope.$digest();
            } else {
              $modalInstance.close(txpr);
            }
          });
        }, 100);
      };


      $scope.remove = function(txp) {
        self.setOngoingProcess(gettextCatalog.getString('Deleting payment'));
        $scope.loading = true;
        $scope.error = null;
        $timeout(function() {
          fc.removeTxProposal(txp, function(err, txpb) {
            self.setOngoingProcess();
            $scope.loading = false;

            // Hacky: request tries to parse an empty response
            if (err && !(err.message && err.message.match(/Unexpected/))) {
              $scope.$emit('UpdateTx');
              $scope.error = bwsError.msg(err, gettextCatalog.getString('Could not delete payment proposal'));
              $scope.$digest();
              return;
            }
            $modalInstance.close();
          });
        }, 100);
      };

      $scope.broadcast = function(txp) {
        self.setOngoingProcess(gettextCatalog.getString('Broadcasting Payment'));
        $scope.loading = true;
        $scope.error = null;
        $timeout(function() {
          fc.broadcastTxProposal(txp, function(err, txpb, memo) {
            self.setOngoingProcess();
            $scope.loading = false;
            if (err) {
              $scope.error = bwsError.msg(err, gettextCatalog.getString('Could not broadcast payment'));
              $scope.$digest();
            } else {

              if (memo)
                $log.info(memo);

              $modalInstance.close(txpb);
            }
          });
        }, 100);
      };

      $scope.copyAddress = function(addr) {
        if (!addr) return;
        self.copyAddress(addr);
      };

      $scope.cancel = lodash.debounce(function() {
        $modalInstance.dismiss('cancel');
      }, 0, 1000);
    };

    var modalInstance = $modal.open({
      templateUrl: 'views/modals/txp-details.html',
      windowClass: animationService.modalAnimated.slideRight,
      controller: ModalInstanceCtrl,
    });

    var disableCloseModal = $rootScope.$on('closeModal', function() {
      modalInstance.dismiss('cancel');
    });

    modalInstance.result.finally(function() {
      $rootScope.modalOpened = false;
      disableCloseModal();
      var m = angular.element(document.getElementsByClassName('reveal-modal'));
      m.addClass(animationService.modalAnimated.slideOutRight);
    });

    modalInstance.result.then(function(txp) {
      self.setOngoingProcess();
      if (txp) {
        txStatus.notify(txp, function() {
          $scope.$emit('Local/TxProposalAction', txp.status == 'broadcasted');
        });
      } else {
        $timeout(function() {
          $scope.$emit('Local/TxProposalAction');
        }, 100);
      }
    });

  };

  this.setAddress = function(forceNew) {
    self.addrError = null;
    var fc = profileService.focusedClient;
    if (!fc)
      return;

    // Address already set?
    if (!forceNew && self.addr[fc.credentials.walletId]) {
      return;
    }

    self.generatingAddress = true;
    $timeout(function() {
      addressService.getAddress(fc.credentials.walletId, forceNew, function(err, addr) {
        self.generatingAddress = false;

        if (err) {
          self.addrError = err;
        } else {
          if (addr)
            self.addr[fc.credentials.walletId] = addr;
        }

        $scope.$digest();
      });
    });
  };

  this.copyAddress = function(addr) {
    if (isCordova) {
      window.cordova.plugins.clipboard.copy(addr);
      window.plugins.toast.showShortCenter(gettextCatalog.getString('Copied to clipboard'));
    } else if (nodeWebkit.isDefined()) {
      nodeWebkit.writeToClipboard(addr);
    }
  };

  this.shareAddress = function(addr) {
    if (isCordova) {
      if (isMobile.Android() || isMobile.Windows()) {
        window.ignoreMobilePause = true;
      }
      window.plugins.socialsharing.share('bitcoin:' + addr, null, null, null);
    }
  };

  this.openCustomizedAmountModal = function(addr) {
    $rootScope.modalOpened = true;
    var self = this;
    var fc = profileService.focusedClient;
    var ModalInstanceCtrl = function($scope, $modalInstance) {
      $scope.addr = addr;
      $scope.color = fc.backgroundColor;
      $scope.unitName = self.unitName;
      $scope.alternativeAmount = self.alternativeAmount;
      $scope.alternativeName = self.alternativeName;
      $scope.alternativeIsoCode = self.alternativeIsoCode;
      $scope.isRateAvailable = self.isRateAvailable;
      $scope.unitToSatoshi = self.unitToSatoshi;
      $scope.unitDecimals = self.unitDecimals;
      var satToUnit = 1 / self.unitToSatoshi;
      $scope.showAlternative = false;
      $scope.isCordova = isCordova;

      Object.defineProperty($scope,
        "_customAlternative", {
          get: function() {
            return $scope.customAlternative;
          },
          set: function(newValue) {
            $scope.customAlternative = newValue;
            if (typeof(newValue) === 'number' && $scope.isRateAvailable) {
              $scope.customAmount = parseFloat((rateService.fromFiat(newValue, $scope.alternativeIsoCode) * satToUnit).toFixed($scope.unitDecimals), 10);
            } else {
              $scope.customAmount = null;
            }
          },
          enumerable: true,
          configurable: true
        });

      Object.defineProperty($scope,
        "_customAmount", {
          get: function() {
            return $scope.customAmount;
          },
          set: function(newValue) {
            $scope.customAmount = newValue;
            if (typeof(newValue) === 'number' && $scope.isRateAvailable) {
              $scope.customAlternative = parseFloat((rateService.toFiat(newValue * $scope.unitToSatoshi, $scope.alternativeIsoCode)).toFixed(2), 10);
            } else {
              $scope.customAlternative = null;
            }
            $scope.alternativeAmount = $scope.customAlternative;
          },
          enumerable: true,
          configurable: true
        });

      $scope.submitForm = function(form) {
        var satToBtc = 1 / 100000000;
        var amount = form.amount.$modelValue;
        var amountSat = parseInt((amount * $scope.unitToSatoshi).toFixed(0));
        $timeout(function() {
          $scope.customizedAmountUnit = amount + ' ' + $scope.unitName;
          $scope.customizedAlternativeUnit = $filter('noFractionNumber')(form.alternative.$modelValue, 2) + ' ' + $scope.alternativeIsoCode;
          if ($scope.unitName == 'bits') {
            amount = (amountSat * satToBtc).toFixed(8);
          }
          $scope.customizedAmountBtc = amount;
        }, 1);
      };

      $scope.toggleAlternative = function() {
        $scope.showAlternative = !$scope.showAlternative;
      };

      $scope.shareAddress = function(uri) {
        if (isCordova) {
          if (isMobile.Android() || isMobile.Windows()) {
            window.ignoreMobilePause = true;
          }
          window.plugins.socialsharing.share(uri, null, null, null);
        }
      };

      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };
    };

    var modalInstance = $modal.open({
      templateUrl: 'views/modals/customized-amount.html',
      windowClass: animationService.modalAnimated.slideUp,
      controller: ModalInstanceCtrl,
    });

    var disableCloseModal = $rootScope.$on('closeModal', function() {
      modalInstance.dismiss('cancel');
    });

    modalInstance.result.finally(function() {
      $rootScope.modalOpened = false;
      disableCloseModal();
      var m = angular.element(document.getElementsByClassName('reveal-modal'));
      m.addClass(animationService.modalAnimated.slideOutDown);
    });
  };

  // Send 

  this.canShowAlternative = function() {
    return $scope.showAlternative;
  };

  this.showAlternative = function() {
    $scope.showAlternative = true;
  };

  this.hideAlternative = function() {
    $scope.showAlternative = false;
  };

  this.resetError = function() {
    this.error = this.success = null;
  };

  this.bindTouchDown = function(tries) {
    var self = this;
    tries = tries || 0;
    if (tries > 5) return;
    var e = document.getElementById('menu-walletHome');
    if (!e) return $timeout(function() {
      self.bindTouchDown(++tries);
    }, 500);

    // on touchdown elements
    $log.debug('Binding touchstart elements...');
    ['hamburger', 'menu-walletHome', 'menu-send', 'menu-receive'].forEach(function(id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener('touchstart', function() {
        try {
          event.preventDefault();
        } catch (e) {};
        angular.element(e).triggerHandler('click');
      }, true);
    });
  }

  this.hideMenuBar = lodash.debounce(function(hide) {
    if (hide) {
      $rootScope.hideMenuBar = true;
      this.bindTouchDown();
    } else {
      $rootScope.hideMenuBar = false;
    }
    $rootScope.$digest();
  }, 100);


  this.formFocus = function(what) {
    if (isCordova && !this.isWindowsPhoneApp) {
      this.hideMenuBar(what);
    }
    if (!this.isWindowsPhoneApp) return

    if (!what) {
      this.hideAddress = false;
      this.hideAmount = false;

    } else {
      if (what == 'amount') {
        this.hideAddress = true;
      } else if (what == 'msg') {
        this.hideAddress = true;
        this.hideAmount = true;
      }
    }
    $timeout(function() {
      $rootScope.$digest();
    }, 1);
  };

  this.setSendFormInputs = function() {
    var unitToSat = this.unitToSatoshi;
    var satToUnit = 1 / unitToSat;
    /**
     * Setting the two related amounts as properties prevents an infinite
     * recursion for watches while preserving the original angular updates
     *
     */
    Object.defineProperty($scope,
      "_alternative", {
        get: function() {
          return $scope.__alternative;
        },
        set: function(newValue) {
          $scope.__alternative = newValue;
          if (typeof(newValue) === 'number' && self.isRateAvailable) {
            $scope._amount = parseFloat((rateService.fromFiat(newValue, self.alternativeIsoCode) * satToUnit).toFixed(self.unitDecimals), 10);
          } else {
            $scope.__amount = null;
          }
        },
        enumerable: true,
        configurable: true
      });
    Object.defineProperty($scope,
      "_amount", {
        get: function() {
          return $scope.__amount;
        },
        set: function(newValue) {
          $scope.__amount = newValue;
          if (typeof(newValue) === 'number' && self.isRateAvailable) {
            $scope.__alternative = parseFloat((rateService.toFiat(newValue * self.unitToSatoshi, self.alternativeIsoCode)).toFixed(2), 10);
          } else {
            $scope.__alternative = null;
          }
          self.alternativeAmount = $scope.__alternative;
          self.resetError();
        },
        enumerable: true,
        configurable: true
      });

    Object.defineProperty($scope,
      "_address", {
        get: function() {
          return $scope.__address;
        },
        set: function(newValue) {
          $scope.__address = self.onAddressChange(newValue);
          if ($scope.sendForm && $scope.sendForm.address.$valid) {
            self.lockAddress = true;
          }
        },
        enumerable: true,
        configurable: true
      });

    var fc = profileService.focusedClient;
    // ToDo: use a credential's (or fc's) function for this
    this.hideNote = !fc.credentials.sharedEncryptingKey;
  };

  this.setSendError = function(err) {
    var fc = profileService.focusedClient;
    var prefix =
      fc.credentials.m > 1 ? gettextCatalog.getString('Could not create payment proposal') : gettextCatalog.getString('Could not send payment');

    this.error = bwsError.msg(err, prefix);

    $timeout(function() {
      $scope.$digest();
    }, 1);
  };


  this.setOngoingProcess = function(name) {
    var self = this;
    self.blockUx = !!name;

    if (isCordova) {
      if (name) {
        window.plugins.spinnerDialog.hide();
        window.plugins.spinnerDialog.show(null, name + '...', true);
      } else {
        window.plugins.spinnerDialog.hide();
      }
    } else {
      self.onGoingProcess = name;
      $timeout(function() {
        $rootScope.$apply();
      });
    };
  };

  this.submitForm = function() {
    var fc = profileService.focusedClient;
    var unitToSat = this.unitToSatoshi;
    var currentSpendUnconfirmed = configWallet.spendUnconfirmed;
    var currentFeeLevel = walletSettings.feeLevel || 'normal';

    this.resetError();

    if (isCordova && this.isWindowsPhoneApp) {
      this.hideAddress = false;
      this.hideAmount = false;
    }

    var form = $scope.sendForm;
    if (form.$invalid) {
      this.error = gettext('Unable to send transaction proposal');
      return;
    }

    var comment = form.comment.$modelValue;

    // ToDo: use a credential's (or fc's) function for this
    if (comment && !fc.credentials.sharedEncryptingKey) {
      var msg = 'Could not add message to imported wallet without shared encrypting key';
      $log.warn(msg);
      return self.setSendError(gettext(msg));
    }

    var getFee = function(cb) {
      if (self.lockedCurrentFeePerKb) {
        cb(null, self.lockedCurrentFeePerKb);
      } else {
        feeService.getCurrentFeeValue(currentFeeLevel, cb);
      }
    };

    $timeout(function() {
      var paypro = self._paypro;
      var address, amount;

      address = form.address.$modelValue;
      amount = parseInt((form.amount.$modelValue * unitToSat).toFixed(0));

      txSignService.prepare(function(err) {
        if (err) {
          return self.setSendError(err);
        }
        self.setOngoingProcess(gettextCatalog.getString('Creating transaction'));
        getFee(function(err, feePerKb) {
          if (err) $log.debug(err);
          fc.sendTxProposal({
            toAddress: address,
            amount: amount,
            message: comment,
            payProUrl: paypro ? paypro.url : null,
            feePerKb: feePerKb,
            excludeUnconfirmedUtxos: currentSpendUnconfirmed ? false : true
          }, function(err, txp) {
            if (err) {
              self.setOngoingProcess();
              return self.setSendError(err);
            }

            if (!fc.canSign() && !fc.isPrivKeyExternal()) {
              self.setOngoingProcess();
              $log.info('No signing proposal: No private key')
              self.resetForm();
              txStatus.notify(txp, function() {
                return $scope.$emit('Local/TxProposalAction');
              });
              return;
            }

            txSignService.signAndBroadcast(txp, {
              reporterFn: self.setOngoingProcess.bind(self)
            }, function(err, txp) {
              self.resetForm();
              if (err) {
                self.error = err.message ? err.message : gettext('The payment was created but could not be completed. Please try again from home screen');
                $scope.$emit('Local/TxProposalAction');
                $timeout(function() {
                  $scope.$digest();
                }, 1);
              } else {
                go.walletHome();
                txStatus.notify(txp, function() {
                  $scope.$emit('Local/TxProposalAction', txp.status == 'broadcasted');
                });
              };
            });
          });
        });
      });
    }, 100);
  };

  this.setForm = function(to, amount, comment) {
    var form = $scope.sendForm;
    if (to) {
      form.address.$setViewValue(to);
      form.address.$isValid = true;
      form.address.$render();
      this.lockAddress = true;
    }

    if (amount) {
      form.amount.$setViewValue("" + amount);
      form.amount.$isValid = true;
      form.amount.$render();
      this.lockAmount = true;
    }

    if (comment) {
      form.comment.$setViewValue(comment);
      form.comment.$isValid = true;
      form.comment.$render();
    }
  };



  this.resetForm = function() {
    this.resetError();
    this._paypro = null;
    this.lockedCurrentFeePerKb = null;

    this.lockAddress = false;
    this.lockAmount = false;

    this._amount = this._address = null;

    var form = $scope.sendForm;

    if (form && form.amount) {
      form.amount.$pristine = true;
      form.amount.$setViewValue('');
      form.amount.$render();

      form.comment.$setViewValue('');
      form.comment.$render();
      form.$setPristine();

      if (form.address) {
        form.address.$pristine = true;
        form.address.$setViewValue('');
        form.address.$render();
      }
    }
    $timeout(function() {
      $rootScope.$digest();
    }, 1);
  };

  this.openPPModal = function(paypro) {
    $rootScope.modalOpened = true;
    var ModalInstanceCtrl = function($scope, $modalInstance) {
      var fc = profileService.focusedClient;
      var satToUnit = 1 / self.unitToSatoshi;
      $scope.paypro = paypro;
      $scope.alternative = self.alternativeAmount;
      $scope.alternativeIsoCode = self.alternativeIsoCode;
      $scope.isRateAvailable = self.isRateAvailable;
      $scope.unitTotal = (paypro.amount * satToUnit).toFixed(self.unitDecimals);
      $scope.unitName = self.unitName;
      $scope.color = fc.backgroundColor;

      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };
    };
    var modalInstance = $modal.open({
      templateUrl: 'views/modals/paypro.html',
      windowClass: animationService.modalAnimated.slideUp,
      controller: ModalInstanceCtrl,
    });

    var disableCloseModal = $rootScope.$on('closeModal', function() {
      modalInstance.dismiss('cancel');
    });

    modalInstance.result.finally(function() {
      $rootScope.modalOpened = false;
      disableCloseModal();
      var m = angular.element(document.getElementsByClassName('reveal-modal'));
      m.addClass(animationService.modalAnimated.slideOutDown);
    });
  };

  this.setFromPayPro = function(uri, cb) {
    if (!cb) cb = function() {};

    var fc = profileService.focusedClient;
    if (isChromeApp) {
      this.error = gettext('Payment Protocol not supported on Chrome App');
      return cb(true);
    }

    var satToUnit = 1 / this.unitToSatoshi;
    var self = this;
    /// Get information of payment if using Payment Protocol
    self.setOngoingProcess(gettextCatalog.getString('Fetching Payment Information'));

    $log.debug('Fetch PayPro Request...', uri);
    $timeout(function() {
      fc.fetchPayPro({
        payProUrl: uri,
      }, function(err, paypro) {
        self.setOngoingProcess();

        if (err) {
          $log.warn('Could not fetch payment request:', err);
          self.resetForm();
          var msg = err.toString();
          if (msg.match('HTTP')) {
            msg = gettext('Could not fetch payment information');
          }
          self.error = msg;
          $timeout(function() {
            $rootScope.$digest();
          }, 1);
          return cb(true);
        }

        if (!paypro.verified) {
          self.resetForm();
          $log.warn('Failed to verify payment protocol signatures');
          self.error = gettext('Payment Protocol Invalid');
          $timeout(function() {
            $rootScope.$digest();
          }, 1);
          return cb(true);
        }

        self._paypro = paypro;
        self.setForm(paypro.toAddress, (paypro.amount * satToUnit).toFixed(self.unitDecimals), paypro.memo);
        return cb();
      });
    }, 1);
  };

  this.setFromUri = function(uri) {
    var self = this;

    function sanitizeUri(uri) {
      // Fixes when a region uses comma to separate decimals
      var regex = /[\?\&]amount=(\d+([\,\.]\d+)?)/i;
      var match = regex.exec(uri);
      if (!match || match.length === 0) {
        return uri;
      }
      var value = match[0].replace(',', '.');
      var newUri = uri.replace(regex, value);
      return newUri;
    };

    var satToUnit = 1 / this.unitToSatoshi;

    // URI extensions for Payment Protocol with non-backwards-compatible request
    if ((/^bitcoin:\?r=[\w+]/).exec(uri)) {
      uri = decodeURIComponent(uri.replace('bitcoin:?r=', ''));
      this.setFromPayPro(uri, function(err) {
        if (err) {
          return err;
        }
      });
    } else {
      uri = sanitizeUri(uri);

      if (!bitcore.URI.isValid(uri)) {
        return uri;
      }
      var parsed = new bitcore.URI(uri);

      var addr = parsed.address ? parsed.address.toString() : '';
      var message = parsed.message;

      var amount = parsed.amount ?
        (parsed.amount.toFixed(0) * satToUnit).toFixed(this.unitDecimals) : 0;


      if (parsed.r) {
        this.setFromPayPro(parsed.r, function(err) {
          if (err && addr && amount) {
            self.setForm(addr, amount, message);
            return addr;
          }
        });
      } else {
        this.setForm(addr, amount, message);
        return addr;
      }
    }

  };

  this.onAddressChange = function(value) {
    this.resetError();
    if (!value) return '';

    if (this._paypro)
      return value;

    if (value.indexOf('bitcoin:') === 0) {
      return this.setFromUri(value);
    } else if (/^https?:\/\//.test(value)) {
      return this.setFromPayPro(value);
    } else {
      return value;
    }
  };

  // History 

  function strip(number) {
    return (parseFloat(number.toPrecision(12)));
  }

  this.getUnitName = function() {
    return this.unitName;
  };

  this.getAlternativeIsoCode = function() {
    return this.alternativeIsoCode;
  };

  this.openTxModal = function(btx) {
    $rootScope.modalOpened = true;
    var self = this;
    var fc = profileService.focusedClient;
    var ModalInstanceCtrl = function($scope, $filter, $log, $modalInstance) {
      $scope.btx = btx;
      $scope.settings = walletSettings;
      $scope.color = fc.backgroundColor;
      $scope.copayerId = fc.credentials.copayerId;
      $scope.isShared = fc.credentials.n > 1; 

      $scope.getAlternativeAmount = function() {
        var satToBtc = 1 / 100000000;
        fc.getFiatRate({ 
          code : self.alternativeIsoCode, 
          ts : btx.time * 1000
        }, function(err, res) {
          if (err) { 
            $log.debug('Could not get historic rate');
            return;
          }
          if (res && res.rate) {
            var alternativeAmountBtc = (btx.amount * satToBtc).toFixed(8);
            $scope.rateDate = res.fetchedOn;
            $scope.rateStr = res.rate + ' ' + self.alternativeIsoCode;
            $scope.alternativeAmountStr = $filter('noFractionNumber')(alternativeAmountBtc * res.rate, 2) + ' ' + self.alternativeIsoCode;
            $scope.$apply();
          }
        });
      };

      $scope.getAmount = function(amount) {
        return self.getAmount(amount);
      };

      $scope.getUnitName = function() {
        return self.getUnitName();
      };

      $scope.getShortNetworkName = function() {
        var n = fc.credentials.network;
        return n.substring(0, 4);
      };

      $scope.copyAddress = function(addr) {
        if (!addr) return;
        self.copyAddress(addr);
      };

      $scope.cancel = lodash.debounce(function() {
        $modalInstance.dismiss('cancel');
      }, 0, 1000);

    };

    var modalInstance = $modal.open({
      templateUrl: 'views/modals/tx-details.html',
      windowClass: animationService.modalAnimated.slideRight,
      controller: ModalInstanceCtrl,
    });

    var disableCloseModal = $rootScope.$on('closeModal', function() {
      modalInstance.dismiss('cancel');
    });

    modalInstance.result.finally(function() {
      $rootScope.modalOpened = false;
      disableCloseModal();
      var m = angular.element(document.getElementsByClassName('reveal-modal'));
      m.addClass(animationService.modalAnimated.slideOutRight);
    });
  };

  this.hasAction = function(actions, action) {
    return actions.hasOwnProperty('create');
  };

  this._doSendAll = function(amount) {
    this.setForm(null, amount, null);
  };

  this.sendAll = function() {
    var self = this;
    self.error = null;
    self.setOngoingProcess(gettextCatalog.getString('Calculating fee'));
    $rootScope.$emit('Local/SetFeeSendMax', function(currentFeePerKb, availableMaxBalance, feeToSendMaxStr) {
      self.setOngoingProcess();
      if (lodash.isNull(currentFeePerKb)) {
        self.error = gettext('Could not calculate fee');
        $scope.$apply();
        return;
      }
      self.lockedCurrentFeePerKb = currentFeePerKb;
      var msg = gettextCatalog.getString("{{fee}} will be deducted for bitcoin networking fees", {
        fee: feeToSendMaxStr
      });

      $scope.$apply();
      confirmDialog.show(msg, function(confirmed) {
        if (confirmed) {
          self._doSendAll(availableMaxBalance);
        } else {
          self.resetForm();
        }
      });
    });
  };

  /* Start setup */

  this.bindTouchDown();
  if (profileService.focusedClient) {
    this.setAddress();
    this.setSendFormInputs();
  }
});
