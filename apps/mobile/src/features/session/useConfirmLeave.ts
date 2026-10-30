import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

/** Leaving keeps the durable draft, including its running/paused state. */
export function useConfirmLeave(active: boolean) {
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!active) return;
        event.preventDefault();
        Alert.alert(
          'Sair da leitura?',
          'Sua sessão fica guardada neste aparelho para continuar depois.',
          [
            { text: 'Continuar', style: 'cancel' },
            {
              text: 'Sair e guardar',
              onPress: () => navigation.dispatch(event.data.action),
            },
          ],
        );
      }),
    [navigation, active],
  );
}
