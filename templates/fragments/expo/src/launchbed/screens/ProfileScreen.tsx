import { Text, View } from "react-native";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ListItem } from "../../../components/ui/ListItem";
import { useSession } from "../session";
import { useAppColors } from "../theme";
import { Screen } from "./Screen";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2) || "?";
}

export function ProfileScreen({ onEdit, onSignedOut }: { onEdit: () => void; onSignedOut: () => void }) {
  const session = useSession();
  const colors = useAppColors();
  const user = session.user;
  return (
    <Screen title="Profile">
      {user ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Avatar initials={initials(user.displayName)} label={user.displayName} size="lg" />
            <View>
              <Text style={{ fontSize: 20, fontWeight: "600", color: colors.onSurface }}>{user.displayName}</Text>
              <Text style={{ color: colors.onSurfaceVariant }}>{user.email}</Text>
            </View>
          </View>
          <Card style={{ padding: 0 }}>
            <ListItem title={user.displayName} subtitle="Display name" />
            <ListItem title={user.email} subtitle="Email" />
          </Card>
          <Button label="Edit profile" variant="outlined" size="lg" onPress={onEdit} />
          <Button
            label="Sign out"
            size="lg"
            style={{ backgroundColor: colors.error }}
            onPress={() => {
              session.signOut();
              onSignedOut();
            }}
          />
        </>
      ) : (
        <Text style={{ color: colors.onSurface }}>You are signed out.</Text>
      )}
    </Screen>
  );
}
