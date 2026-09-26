import { Redirect } from 'expo-router';

export default function IndexScreen() {
  // Session bootstrap will replace this direct redirect once the Better Auth
  // server is mounted. Keeping it explicit avoids rendering a fake signed-in state.
  return <Redirect href="/(auth)/login" />;
}
