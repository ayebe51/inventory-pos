import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, message } from 'antd';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ open, onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(true);

  useEffect(() => {
    let controls: any = null;
    const codeReader = new BrowserMultiFormatReader();

    if (open && videoRef.current) {
      codeReader.decodeFromVideoDevice(null, videoRef.current, (result, error, ctrls) => {
        controls = ctrls;
        if (result) {
          onScan(result.getText());
          onClose(); // Auto close on successful scan
        }
        if (error && error.name !== 'NotFoundException') {
          // ignore not found as it scans continuously
        }
      }).catch((err) => {
        setHasCamera(false);
        message.warning('Camera not accessible or not found. Fallback to manual entry.');
      });
    }

    return () => {
      if (controls) {
        controls.stop();
      }
    };
  }, [open, onScan, onClose]);

  return (
    <Modal
      title="Scan Barcode"
      open={open}
      onCancel={onClose}
      footer={
        <Button onClick={onClose}>Close</Button>
      }
      destroyOnClose
    >
      {hasCamera ? (
        <div style={{ textAlign: 'center' }}>
          <video ref={videoRef} style={{ width: '100%', borderRadius: 8 }} />
          <p style={{ marginTop: 8, color: '#94A3B8' }}>Position the barcode within the camera view to scan.</p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#F43F5E' }}>
          Camera not available. Please use a physical barcode scanner or enter manually.
        </div>
      )}
    </Modal>
  );
};
