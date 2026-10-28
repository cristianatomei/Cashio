import { Button } from '@/core/ui';

export function PlanningButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return <Button title={title} onPress={onPress} disabled={disabled} variant="secondary" />;
}
