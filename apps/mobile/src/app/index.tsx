import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-risk-high">Antigolpe</Text>
      <Text className="mt-2 text-center text-base text-gray-600">
        Confira links e mensagens antes de pagar ou clicar.
      </Text>
    </View>
  );
}
