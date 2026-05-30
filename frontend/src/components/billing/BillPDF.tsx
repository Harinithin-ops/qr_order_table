import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDate, HOTEL_NAME, HOTEL_ADDRESS, HOTEL_PHONE, HOTEL_GST } from '@/lib/utils';
import { BillData, OrderWithItems } from '@/types';

// Create styles
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { textAlign: 'center', marginBottom: 20 },
  hotelName: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  address: { fontSize: 10, marginBottom: 2, color: '#666' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#eee', marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  bold: { fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 4, marginBottom: 8, fontWeight: 'bold' },
  colItem: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1, textAlign: 'right' },
  colAmount: { flex: 1, textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  totalsArea: { marginTop: 10, marginLeft: '50%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grandTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#000', marginTop: 4, fontWeight: 'bold' },
  footer: { marginTop: 40, textAlign: 'center', fontSize: 9, color: '#666' }
});

interface BillPDFProps {
  bill: BillData & { order: OrderWithItems };
}

export function BillDocument({ bill }: BillPDFProps) {
  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.hotelName}>{HOTEL_NAME}</Text>
          <Text style={styles.address}>{HOTEL_ADDRESS}</Text>
          <Text style={styles.address}>Phone: {HOTEL_PHONE} | GST: {HOTEL_GST}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text>Bill No: <Text style={styles.bold}>{bill.billNumber}</Text></Text>
          <Text>Date: {formatDate(bill.createdAt)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Table: <Text style={styles.bold}>{bill.order.table.tableNumber}</Text></Text>
          <Text>Status: {bill.paymentStatus}</Text>
        </View>

        <View style={{ marginTop: 20 }} />

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={styles.colItem}>Item</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Price</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>

        {/* Items */}
        {bill.order.items.map((item, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={styles.colItem}>{item.menuItem.name}</Text>
            <Text style={styles.colQty}>{item.quantity}</Text>
            <Text style={styles.colPrice}>{formatCurrency(item.price)}</Text>
            <Text style={styles.colAmount}>{formatCurrency(item.price * item.quantity)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsArea}>
          <View style={styles.totalRow}>
            <Text>Subtotal:</Text>
            <Text>{formatCurrency(bill.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>GST (2%):</Text>
            <Text>{formatCurrency(bill.taxAmount)}</Text>
          </View>
          {bill.discount > 0 && (
            <View style={styles.totalRow}>
              <Text>Discount:</Text>
              <Text>-{formatCurrency(bill.discount)}</Text>
            </View>
          )}
          <View style={styles.grandTotal}>
            <Text>Grand Total:</Text>
            <Text>{formatCurrency(bill.total)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Thank you for dining with us!</Text>
          <Text>Visit Again</Text>
        </View>
      </Page>
    </Document>
  );
}
