"""Real installed tools are exercised; missing tools remain explicit blockers."""

from engines.native.probe import evaluate


def test_native_probes_separate_compilation_and_execution():
    record = evaluate()
    checks = {item["backend"]: item for item in record["checks"]}
    assert set(checks) == {"openmp", "cuda"}
    for item in checks.values():
        assert item["requiresGpu"] is False
        assert item["sourceHash"].startswith("sha256:")
        if item["status"] == "blocked":
            assert item["reason"]
            assert not item["stages"]
        for stage in item["stages"]:
            assert stage["invocation"]["argv"]
            if stage["status"] == "passed":
                assert stage["invocation"]["exitCode"] == 0
    assert all(s["evidenceClass"] == "artifact" for s in checks["cuda"]["stages"])
    for stage in checks["openmp"]["stages"]:
        if stage["stage"] == "owned-cpu-reference" and stage["status"] == "passed":
            assert stage["actual"] == stage["expected"] == sum(range(1024))
            assert stage["openmpSpecification"] > 0


def test_probe_timeout_is_inconclusive_not_a_kernel_failure(monkeypatch):
    import subprocess
    from engines.native import probe

    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired(args[0], probe.TIMEOUT_SECONDS)

    monkeypatch.setattr(probe.subprocess, "run", timeout)
    invocation = probe.command(["owned-fixture"])
    assert probe.stage("frontend", invocation, "artifact")["status"] == "unknown"
    assert invocation["exitCode"] is None
