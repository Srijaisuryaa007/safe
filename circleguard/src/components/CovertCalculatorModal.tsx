import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Vibration,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CovertCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  onDuressSosTriggered: () => void;
}

export default function CovertCalculatorModal({
  visible,
  onClose,
  onDuressSosTriggered,
}: CovertCalculatorModalProps) {
  const insets = useSafeAreaInsets();
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [clearOnNext, setClearOnNext] = useState(false);
  const [secretTapCount, setSecretTapCount] = useState(0);

  const handleDigit = (digit: string) => {
    if (display === '0' || clearOnNext) {
      setDisplay(digit);
      setClearOnNext(false);
    } else {
      if (display.length < 12) {
        setDisplay(display + digit);
      }
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setClearOnNext(false);
  };

  const handleOperator = (op: string) => {
    const current = parseFloat(display);
    setPrevValue(current);
    setOperation(op);
    setClearOnNext(true);
  };

  const handleEquals = () => {
    // Duress PIN Check: 911, 999, 112, 0000, or 4444
    if (
      display === '911' ||
      display === '999' ||
      display === '112' ||
      display === '0000' ||
      display === '4444'
    ) {
      if (Platform.OS !== 'web') {
        Vibration.vibrate(50); // Subtle 50ms vibration confirmation
      }
      onDuressSosTriggered();
      setDisplay('0');
      setPrevValue(null);
      setOperation(null);
      return;
    }

    if (prevValue === null || !operation) return;
    const current = parseFloat(display);
    let result = 0;
    switch (operation) {
      case '+': result = prevValue + current; break;
      case '-': result = prevValue - current; break;
      case '×': result = prevValue * current; break;
      case '÷': result = current !== 0 ? prevValue / current : 0; break;
    }
    const resultStr = String(parseFloat(result.toFixed(6)));
    setDisplay(resultStr);
    setPrevValue(null);
    setOperation(null);
    setClearOnNext(true);
  };

  const handleSecretExit = () => {
    const nextCount = secretTapCount + 1;
    setSecretTapCount(nextCount);
    if (nextCount >= 3) {
      setSecretTapCount(0);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
        {/* Discrete Covert Header: Tapping title 3 times cleanly exits back */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSecretExit} activeOpacity={0.8} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Text style={styles.headerTitle}>Calculator</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={styles.discreteExit}>
            <Text style={styles.discreteExitText}>×</Text>
          </TouchableOpacity>
        </View>

        {/* Calculator Display */}
        <View style={styles.displayContainer}>
          <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
            {display}
          </Text>
        </View>

        {/* Buttons Grid (Standard Apple-Style Dark Calculator Layout) */}
        <View style={styles.keypad}>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnFunc]} onPress={handleClear}>
              <Text style={styles.btnTextFunc}>AC</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnFunc]} onPress={() => setDisplay(String(-parseFloat(display)))}>
              <Text style={styles.btnTextFunc}>±</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnFunc]} onPress={() => setDisplay(String(parseFloat(display) / 100))}>
              <Text style={styles.btnTextFunc}>%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOp]} onPress={() => handleOperator('÷')}>
              <Text style={styles.btnTextOp}>÷</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('7')}>
              <Text style={styles.btnText}>7</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('8')}>
              <Text style={styles.btnText}>8</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('9')}>
              <Text style={styles.btnText}>9</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOp]} onPress={() => handleOperator('×')}>
              <Text style={styles.btnTextOp}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('4')}>
              <Text style={styles.btnText}>4</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('5')}>
              <Text style={styles.btnText}>5</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('6')}>
              <Text style={styles.btnText}>6</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOp]} onPress={() => handleOperator('-')}>
              <Text style={styles.btnTextOp}>−</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('1')}>
              <Text style={styles.btnText}>1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('2')}>
              <Text style={styles.btnText}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => handleDigit('3')}>
              <Text style={styles.btnText}>3</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOp]} onPress={() => handleOperator('+')}>
              <Text style={styles.btnTextOp}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnZero]} onPress={() => handleDigit('0')}>
              <Text style={[styles.btnText, { paddingLeft: 28 }]}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => { if (!display.includes('.')) setDisplay(display + '.'); }}>
              <Text style={styles.btnText}>.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOp]} onPress={handleEquals}>
              <Text style={styles.btnTextOp}>=</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  discreteExit: {
    padding: 8,
  },
  discreteExitText: {
    color: '#222222',
    fontSize: 18,
  },
  displayContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  displayText: {
    color: '#FFFFFF',
    fontSize: 68,
    fontWeight: '300',
    letterSpacing: -1,
  },
  keypad: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnZero: {
    flex: 2.15,
    alignItems: 'flex-start',
  },
  btnFunc: {
    backgroundColor: '#A5A5A5',
  },
  btnOp: {
    backgroundColor: '#FF9F0A',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '400',
  },
  btnTextFunc: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '500',
  },
  btnTextOp: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '500',
  },
});
