import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Phone, Mail, MapPin, Building, Plus, Search, ChevronRight, X, FileSpreadsheet } from 'lucide-react-native';
import { useAppContext } from '../_layout';
import { COLORS, TYPOGRAPHY, SHADOWS, COMMON_STYLES } from '../../components/Theme';
import { Input } from '../../components/Input';
import { Button } from '../components/Button';

export default function ClientsScreen() {
  const router = useRouter();
  const { clients, addClient, setCurrentQuoteId } = useAppContext();
  
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // New client form states
  const [name, setName] = useState('');
  const [person, setPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.companyName && c.companyName.toLowerCase().includes(search.toLowerCase())) ||
    c.phone.includes(search)
  );

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Falta nombre', 'El nombre del cliente o empresa es obligatorio.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Falta teléfono', 'El teléfono es obligatorio para contactar.');
      return;
    }

    addClient({
      name,
      contactPerson: person || undefined,
      phone,
      email: email || undefined,
      companyName: company || undefined,
      address: address || undefined,
      city: city || undefined,
    });

    // Reset and close
    setName('');
    setPerson('');
    setPhone('');
    setEmail('');
    setCompany('');
    setAddress('');
    setCity('');
    setIsAdding(false);
    
    Alert.alert('¡Excelente!', 'El cliente ha sido guardado exitosamente.');
  };

  const handleCreateQuoteForClient = (clientId: string) => {
    // Inject selected client id as editing state in our provider, then push to creation
    setCurrentQuoteId(clientId); // Serves as temporary client preselector if editing is null
    router.push({
      pathname: '/create-quote',
      params: { selectedClientId: clientId }
    });
  };

  return (
    <View style={COMMON_STYLES.container}>
      {isAdding ? (
        // Add Client form
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.formHeader}>
            <Text style={TYPOGRAPHY.h2}>Nuevo Cliente</Text>
            <TouchableOpacity onPress={() => setIsAdding(false)} style={styles.closeBtn}>
              <X size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Input
            label="Nombre Comercial o Fiscal *"
            placeholder="Ej. Talleres Mecánicos J. Delgado"
            value={name}
            onChangeText={setName}
          />

          <Input
            label="Persona de Contacto"
            placeholder="Ej. Juan Delgado Garcia"
            value={person}
            onChangeText={setPerson}
          />

          <Input
            label="Teléfono Móvil *"
            placeholder="Ej. +34 611 222 333"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Input
            label="Email"
            placeholder="Ej. juan@talleresdelgado.es"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Input
            label="Nombre de la Empresa"
            placeholder="Ej. Talleres Delgado S.L."
            value={company}
            onChangeText={setCompany}
          />

          <Input
            label="Dirección de Facturación"
            placeholder="Ej. Polígono Industrial Prado, Nave 12"
            value={address}
            onChangeText={setAddress}
          />

          <Input
            label="Ciudad / Provincia"
            placeholder="Ej. Sevilla"
            value={city}
            onChangeText={setCity}
          />

          <View style={styles.formActions}>
            <Button
              title="Guardar Cliente"
              onPress={handleSave}
              variant="success"
              style={{ flex: 1 }}
            />
            <Button
              title="Cancelar"
              onPress={() => setIsAdding(false)}
              variant="outline"
              size="normal"
            />
          </View>
        </ScrollView>
      ) : (
        // Clients Directory Listing
        <View style={{ flex: 1 }}>
          <View style={styles.searchBarContainer}>
            <View style={styles.searchInner}>
              <Search size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Buscar por nombre, empresa o tfno..."
                placeholderTextColor={COLORS.textLight}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity 
              onPress={() => setIsAdding(true)} 
              style={styles.addBtn}
              activeOpacity={0.8}
            >
              <Plus size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollList}>
            {filteredClients.length === 0 ? (
              <View style={styles.emptyContainer}>
                <User size={40} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No se encontraron clientes coincidentes.</Text>
              </View>
            ) : (
              filteredClients.map((client) => {
                const isExpanded = selectedClientId === client.id;
                return (
                  <View key={client.id} style={[styles.clientCard, isExpanded ? styles.clientCardExpanded : null]}>
                    <TouchableOpacity
                      onPress={() => setSelectedClientId(isExpanded ? null : client.id)}
                      activeOpacity={0.7}
                      style={styles.clientItemRow}
                    >
                      <View style={styles.clientAvatar}>
                        <Text style={styles.avatarText}>
                          {client.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clientTitle}>{client.name}</Text>
                        {client.companyName ? (
                          <Text style={styles.clientCompanySub}>{client.companyName}</Text>
                        ) : null}
                        <Text style={styles.clientPhoneSub}>{client.phone}</Text>
                      </View>
                      <ChevronRight 
                        size={18} 
                        color={COLORS.textLight} 
                        style={{
                          transform: [{ rotate: isExpanded ? '90deg' : '0deg' }],
                        }}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.expandedDetails}>
                        {client.contactPerson && (
                          <View style={styles.detailRow}>
                            <User size={14} color={COLORS.textSecondary} style={styles.detailIcon} />
                            <Text style={styles.detailText}>Contacto: {client.contactPerson}</Text>
                          </View>
                        )}
                        {client.email && (
                          <View style={styles.detailRow}>
                            <Mail size={14} color={COLORS.textSecondary} style={styles.detailIcon} />
                            <Text style={styles.detailText}>{client.email}</Text>
                          </View>
                        )}
                        {client.address && (
                          <View style={styles.detailRow}>
                            <MapPin size={14} color={COLORS.textSecondary} style={styles.detailIcon} />
                            <Text style={styles.detailText}>
                              {client.address}{client.city ? `, ${client.city}` : ''}
                            </Text>
                          </View>
                        )}

                        <View style={styles.detailActions}>
                          <TouchableOpacity 
                            onPress={() => handleCreateQuoteForClient(client.id)}
                            style={[styles.actionButton, { backgroundColor: COLORS.secondaryLight }]}
                          >
                            <FileSpreadsheet size={14} color={COLORS.secondary} />
                            <Text style={[styles.actionButtonText, { color: COLORS.secondary }]}>
                              Crear Presupuesto
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            onPress={() => Alert.alert('Llamada Simulada', `Llamando a ${client.name} al móvil ${client.phone}...`)}
                            style={[styles.actionButton, { backgroundColor: COLORS.successLight }]}
                          >
                            <Phone size={14} color={COLORS.success} />
                            <Text style={[styles.actionButtonText, { color: COLORS.success }]}>
                              Llamar
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    padding: 24,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeBtn: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  searchInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  addBtn: {
    height: 44,
    width: 44,
    borderRadius: 6,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  clientCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOWS.xs,
  },
  clientCardExpanded: {
    borderColor: COLORS.secondary,
  },
  clientItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  clientAvatar: {
    height: 44,
    width: 44,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  clientTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  clientCompanySub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  clientPhoneSub: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  expandedDetails: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 6,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
