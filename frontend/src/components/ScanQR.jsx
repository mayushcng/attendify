import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';

const ScanQR = () => {
  const navigate = useNavigate();
  const scannerRef = useRef(null);

  useEffect(() => {
    // This useRef logic prevents the scanner from initializing twice in development
    if (scannerRef.current) {
      return;
    }

    const qrReaderId = "qr-reader";
    const html5QrCode = new Html5Qrcode(qrReaderId);
    scannerRef.current = html5QrCode;
    
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
      console.log(`Scan result: ${decodedText}`);
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          navigate(`/verify/${decodedText}`);
        }).catch(err => {
          console.error("Failed to stop the scanner.", err);
          navigate(`/verify/${decodedText}`);
        });
      }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
      .catch(err => {
        console.error("Unable to start scanning.", err);
      });

    // Cleanup function to stop the scanner when the component unmounts
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => {
          console.error("Failed to stop the scanner on cleanup.", err);
        });
      }
    };
  }, [navigate]);

  return (
    <div>
      <h3>Scan QR Code</h3>
      <p>Point your camera at the QR code displayed by your teacher.</p>
      <div id="qr-reader" style={{ width: '320px', margin: 'auto' }}></div>
    </div>
  );
};

export default ScanQR;