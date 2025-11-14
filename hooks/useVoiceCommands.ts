import { useState, useEffect, useCallback, useRef } from 'react';
import Voice, {
  SpeechRecognizedEvent,
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import { Audio } from 'expo-av';
import { useAuth } from './useAuth';

// Voice command types
export type VoiceCommand = {
  command: string;
  action: () => void;
  description: string;
  keywords: string[];
};

export type VoiceCommandResult = {
  command: string;
  confidence: number;
  action?: () => void;
};

class VoiceCommandService {
  private isListening: boolean = false;
  private commands: Map<string, VoiceCommand> = new Map();
  private soundObject: Audio.Sound | null = null;

  constructor() {
    this.setupVoiceHandlers();
  }

  // Setup voice recognition handlers
  private setupVoiceHandlers(): void {
    Voice.onSpeechStart = this.onSpeechStart.bind(this);
    Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
    Voice.onSpeechResults = this.onSpeechResults.bind(this);
    Voice.onSpeechError = this.onSpeechError.bind(this);
    Voice.onSpeechRecognized = this.onSpeechRecognized.bind(this);
  }

  // Initialize voice service
  async initialize(): Promise<void> {
    try {
      // Check voice recognition availability
      const isAvailable = await Voice.isAvailable();
      if (!isAvailable) {
        console.warn('Voice recognition not available on this device');
        return;
      }

      // Setup beep sound for feedback
      await this.setupBeepSound();

      console.log('Voice command service initialized');
    } catch (error) {
      console.error('Failed to initialize voice service:', error);
    }
  }

  // Setup beep sound for voice feedback
  private async setupBeepSound(): Promise<void> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/beep.mp3') // You'll need to add this sound file
      );
      this.soundObject = sound;
    } catch (error) {
      console.warn('Could not load beep sound:', error);
    }
  }

  // Play beep sound
  private async playBeep(): Promise<void> {
    if (this.soundObject) {
      try {
        await this.soundObject.replayAsync();
      } catch (error) {
        console.warn('Could not play beep sound:', error);
      }
    }
  }

  // Start listening for voice commands
  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      this.isListening = true;

      await Voice.start('en-US', {
        extraPullPaths: [Voice.DIRPATH],
        RECOGNIZER_ENGINE: 'GOOGLE',
        PROMPT_FILTER: 0,
        PARTIAL_RESULTS: true,
        MAX_RESULTS: 3,
        CONTINUOUS: false,
      });

      console.log('Voice listening started');
    } catch (error) {
      console.error('Failed to start voice listening:', error);
      this.isListening = false;
    }
  }

  // Stop listening for voice commands
  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      this.isListening = false;
      await Voice.stop();
      await Voice.destroy();

      console.log('Voice listening stopped');
    } catch (error) {
      console.error('Failed to stop voice listening:', error);
    }
  }

  // Speech event handlers
  private onSpeechStart(): void {
    console.log('Speech started');
    this.playBeep();
  }

  private onSpeechEnd(): void {
    console.log('Speech ended');
    this.isListening = false;
  }

  private onSpeechResults(e: SpeechResultsEvent): void {
    if (!e.value) return;

    const results = e.value;
    const recognizedCommand = this.parseVoiceCommand(results[0]);

    if (recognizedCommand) {
      console.log('Voice command recognized:', recognizedCommand);
      this.executeCommand(recognizedCommand);
    } else {
      console.log('No valid command recognized in:', results[0]);
    }
  }

  private onSpeechError(e: SpeechErrorEvent): void {
    console.error('Speech recognition error:', e.error);
    this.isListening = false;
  }

  private onSpeechRecognized(e: SpeechRecognizedEvent): void {
    console.log('Speech recognized:', e.value);
  }

  // Parse voice command from speech
  private parseVoiceCommand(speech: string): VoiceCommandResult | null {
    const normalizedSpeech = speech.toLowerCase().trim();

    // Check each command for keyword matches
    for (const [commandId, command] of this.commands.entries()) {
      for (const keyword of command.keywords) {
        if (normalizedSpeech.includes(keyword.toLowerCase())) {
          return {
            command: command.command,
            confidence: this.calculateConfidence(normalizedSpeech, keyword),
            action: command.action,
          };
        }
      }
    }

    return null;
  }

  // Calculate confidence score for command recognition
  private calculateConfidence(speech: string, keyword: string): number {
    const words = speech.split(' ');
    const keywordWords = keyword.split(' ');

    let matchCount = 0;
    for (const keywordWord of keywordWords) {
      if (words.some(word => word.includes(keywordWord) || keywordWord.includes(word))) {
        matchCount++;
      }
    }

    return matchCount / keywordWords.length;
  }

  // Execute recognized command
  private executeCommand(result: VoiceCommandResult): void {
    if (result.action && result.confidence > 0.5) {
      this.playBeep();
      result.action();
    }
  }

  // Register voice command
  registerCommand(commandId: string, command: VoiceCommand): void {
    this.commands.set(commandId, command);
    console.log(`Voice command registered: ${command.command}`);
  }

  // Unregister voice command
  unregisterCommand(commandId: string): void {
    this.commands.delete(commandId);
    console.log(`Voice command unregistered: ${commandId}`);
  }

  // Get available commands
  getAvailableCommands(): VoiceCommand[] {
    return Array.from(this.commands.values());
  }

  // Cleanup
  async destroy(): Promise<void> {
    await this.stopListening();
    await Voice.destroy();

    if (this.soundObject) {
      await this.soundObject.unloadAsync();
    }

    this.commands.clear();
    console.log('Voice command service destroyed');
  }
}

// Hook for using voice commands
export const useVoiceCommands = () => {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [recognizedCommand, setRecognizedCommand] = useState<string>('');
  const { user } = useAuth();
  const voiceServiceRef = useRef<VoiceCommandService | null>(null);

  // Initialize voice service
  useEffect(() => {
    const initializeVoice = async () => {
      const service = new VoiceCommandService();
      voiceServiceRef.current = service;

      // Check availability
      const available = await Voice.isAvailable();
      setIsAvailable(available);

      if (available) {
        await service.initialize();
        setupCommandsForUserType(service, user?.userType);
      }
    };

    initializeVoice();

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.destroy();
      }
    };
  }, [user?.userType]);

  // Setup commands based on user type
  const setupCommandsForUserType = useCallback((service: VoiceCommandService, userType?: string) => {
    if (!service) return;

    // Clear existing commands
    service.destroy();
    service.initialize();

    // Common commands for all users
    service.registerCommand('help', {
      command: 'help',
      description: 'List available voice commands',
      keywords: ['help', 'commands', 'what can i say'],
      action: () => {
        const commands = service.getAvailableCommands();
        const commandList = commands.map(cmd => `${cmd.command}: ${cmd.description}`).join(', ');
        speak(`Available commands: ${commandList}`);
      },
    });

    service.registerCommand('dashboard', {
      command: 'dashboard',
      description: 'Navigate to dashboard',
      keywords: ['dashboard', 'home', 'main'],
      action: () => {
        // Navigate to dashboard - this would need navigation prop
        console.log('Navigate to dashboard');
      },
    });

    service.registerCommand('reputation', {
      command: 'reputation',
      description: 'Read reputation score',
      keywords: ['reputation', 'score', 'reputation score', 'what is my reputation'],
      action: () => {
        if (user?.reputationScore) {
          speak(`Your reputation score is ${user.reputationScore}`);
        } else {
          speak('Reputation score not available');
        }
      },
    });

    // Blind user specific commands
    if (userType === 'blind') {
      service.registerCommand('call', {
        command: 'call',
        description: 'Start a volunteer call',
        keywords: ['call', 'call volunteer', 'get help', 'start call', 'need help'],
        action: () => {
          console.log('Start volunteer call');
          // Trigger matching process
        },
      });

      service.registerCommand('end_call', {
        command: 'end_call',
        description: 'End current call',
        keywords: ['end call', 'hang up', 'disconnect', 'stop call'],
        action: () => {
          console.log('End call');
          // End current call
        },
      });
    }

    // Volunteer user specific commands
    if (userType === 'volunteer') {
      service.registerCommand('available', {
        command: 'available',
        description: 'Set availability status',
        keywords: ['available', 'available for calls', 'ready to help'],
        action: () => {
          console.log('Set availability to available');
          // Update availability
        },
      });

      service.registerCommand('unavailable', {
        command: 'unavailable',
        description: 'Set unavailable status',
        keywords: ['unavailable', 'busy', 'not available'],
        action: () => {
          console.log('Set availability to unavailable');
          // Update availability
        },
      });
    }

    // General commands
    service.registerCommand('wallet', {
      command: 'wallet',
      description: 'Navigate to wallet',
      keywords: ['wallet', 'rewards', 'earnings'],
      action: () => {
        console.log('Navigate to wallet');
        // Navigate to wallet screen
      },
    });

    service.registerCommand('balance', {
      command: 'balance',
      description: 'Read wallet balance',
      keywords: ['balance', 'how much', 'wallet balance'],
      action: () => {
        console.log('Read wallet balance');
        // Get and speak balance
      },
    });
  }, [user]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!voiceServiceRef.current || !isAvailable) return;

    try {
      setIsListening(true);
      await voiceServiceRef.current.startListening();
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsListening(false);
    }
  }, [isAvailable]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!voiceServiceRef.current) return;

    try {
      setIsListening(false);
      await voiceServiceRef.current.stopListening();
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Text-to-speech function
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      speechSynthesis.speak(utterance);
    } else {
      console.log('TTS not available:', text);
    }
  }, []);

  // Get available commands
  const getAvailableCommands = useCallback(() => {
    return voiceServiceRef.current?.getAvailableCommands() || [];
  }, []);

  return {
    isListening,
    isAvailable,
    recognizedCommand,
    startListening,
    stopListening,
    toggleListening,
    getAvailableCommands,
    speak,
  };
};

// Text-to-speech utility
export const speak = (text: string): void => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    speechSynthesis.speak(utterance);
  } else {
    console.log('TTS not available:', text);
  }
};

export default useVoiceCommands;