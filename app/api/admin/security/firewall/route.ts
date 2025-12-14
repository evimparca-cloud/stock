import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

interface SecurityAction {
    action: 'check_ufw' | 'enable_ufw' | 'install_ufw' | 'check_fail2ban' | 'install_fail2ban' | 'check_updates';
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: SecurityAction = await request.json();

        switch (body.action) {
            case 'check_ufw': {
                try {
                    // Check if UFW is installed
                    const { stdout: versionCheck } = await execAsync('which ufw');

                    if (!versionCheck.trim()) {
                        return NextResponse.json({
                            installed: false,
                            active: false,
                            message: 'UFW kurulu değil'
                        });
                    }

                    // Check UFW status
                    const { stdout } = await execAsync('ufw status verbose 2>&1 || echo "inactive"');
                    const isActive = stdout.includes('Status: active');

                    // Parse rules
                    const rules = [];
                    const ruleLines = stdout.split('\n').filter(line =>
                        line.includes('ALLOW') || line.includes('DENY')
                    );

                    for (const line of ruleLines) {
                        rules.push(line.trim());
                    }

                    return NextResponse.json({
                        installed: true,
                        active: isActive,
                        status: stdout,
                        rules: rules,
                        message: isActive ? 'UFW aktif ve çalışıyor' : 'UFW kurulu ama pasif'
                    });
                } catch (error: any) {
                    return NextResponse.json({
                        installed: false,
                        active: false,
                        error: error.message
                    });
                }
            }

            case 'install_ufw': {
                try {
                    // Install UFW
                    await execAsync('apt-get update -qq && apt-get install -y ufw');

                    // Set default policies
                    await execAsync('ufw --force default deny incoming');
                    await execAsync('ufw --force default allow outgoing');

                    // Allow SSH, HTTP, HTTPS
                    await execAsync('ufw allow 22/tcp comment "SSH"');
                    await execAsync('ufw allow 80/tcp comment "HTTP"');
                    await execAsync('ufw allow 443/tcp comment "HTTPS"');

                    return NextResponse.json({
                        success: true,
                        message: 'UFW kuruldu ve kurallar eklendi. Henüz aktif değil.'
                    });
                } catch (error: any) {
                    return NextResponse.json({
                        success: false,
                        error: error.message
                    }, { status: 500 });
                }
            }

            case 'enable_ufw': {
                try {
                    // Enable UFW
                    await execAsync('echo "y" | ufw enable');

                    const { stdout } = await execAsync('ufw status');

                    return NextResponse.json({
                        success: true,
                        message: 'UFW aktifleştirildi!',
                        status: stdout
                    });
                } catch (error: any) {
                    return NextResponse.json({
                        success: false,
                        error: error.message
                    }, { status: 500 });
                }
            }

            case 'check_fail2ban': {
                try {
                    const { stdout } = await execAsync('systemctl is-active fail2ban 2>/dev/null || echo "inactive"');
                    const isActive = stdout.trim() === 'active';

                    let jails: string[] = [];
                    if (isActive) {
                        const { stdout: jailStatus } = await execAsync('fail2ban-client status 2>&1 || echo ""');
                        jails = jailStatus.match(/Jail list:\s+(.+)/)?.[1]?.split(',').map(j => j.trim()) || [];
                    }

                    return NextResponse.json({
                        installed: isActive || stdout.includes('inactive'),
                        active: isActive,
                        jails: jails,
                        message: isActive ? 'Fail2ban aktif' : 'Fail2ban kurulu değil veya pasif'
                    });
                } catch (error: any) {
                    return NextResponse.json({
                        installed: false,
                        active: false,
                        error: error.message
                    });
                }
            }

            case 'install_fail2ban': {
                try {
                    // Install Fail2ban
                    await execAsync('apt-get update -qq && apt-get install -y fail2ban');

                    // Create SSH jail configuration
                    const jailConfig = `[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
`;

                    await execAsync(`echo '${jailConfig}' > /etc/fail2ban/jail.local`);
                    await execAsync('systemctl enable fail2ban');
                    await execAsync('systemctl restart fail2ban');

                    return NextResponse.json({
                        success: true,
                        message: 'Fail2ban kuruldu ve aktifleştirildi'
                    });
                } catch (error: any) {
                    return NextResponse.json({
                        success: false,
                        error: error.message
                    }, { status: 500 });
                }
            }

            case 'check_updates': {
                try {
                    const { stdout } = await execAsync('dpkg -l | grep unattended-upgrades || echo "not_installed"');
                    const isInstalled = !stdout.includes('not_installed');

                    return NextResponse.json({
                        installed: isInstalled,
                        message: isInstalled ? 'Otomatik güncellemeler kurulu' : 'Kurulu değil'
                    });
                } catch (error: any) {
                    return NextResponse.json({
                        installed: false,
                        error: error.message
                    });
                }
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Security action error:', error);
        return NextResponse.json(
            { error: error.message || 'İşlem başarısız' },
            { status: 500 }
        );
    }
}
