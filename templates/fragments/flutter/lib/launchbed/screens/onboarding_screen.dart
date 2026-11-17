import 'package:material_ui/material_ui.dart';

import '../../ui/components/button.dart';

class OnboardingPage {
  const OnboardingPage(this.title, this.body);
  final String title;
  final String body;
}

const onboardingPages = <OnboardingPage>[
  OnboardingPage('Welcome', 'A short tour of this generated app.'),
  OnboardingPage('Your data stays here', 'This starter keeps everything in memory on the device.'),
  OnboardingPage('You are ready', 'Continue to start using the app.'),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onFinished});

  final VoidCallback onFinished;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final page = onboardingPages[_index];
    final last = _index == onboardingPages.length - 1;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(header: true, child: Text(page.title, style: theme.textTheme.headlineLarge)),
                    const SizedBox(height: 12),
                    Text(page.body, style: theme.textTheme.bodyLarge?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    const SizedBox(height: 16),
                    Semantics(
                      label: 'Page ${_index + 1} of ${onboardingPages.length}',
                      child: Row(
                        children: [
                          for (var dot = 0; dot < onboardingPages.length; dot++)
                            Container(
                              margin: const EdgeInsets.only(right: 6),
                              height: 8,
                              width: dot == _index ? 24 : 8,
                              decoration: BoxDecoration(
                                color: dot == _index ? theme.colorScheme.primary : theme.colorScheme.outlineVariant,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  LaunchbedButton(label: 'Skip', variant: LaunchbedButtonVariant.text, onPressed: widget.onFinished),
                  LaunchbedButton(
                    label: last ? 'Get started' : 'Next',
                    onPressed: () => last ? widget.onFinished() : setState(() => _index++),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
